/**
 * Copyright 2015-present Greg Hurrell. All rights reserved.
 * Licensed under the terms of the MIT license.
 *
 * @flow
 */

'use strict';

import autobind from 'autobind-decorator';
import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';

import Actions from '../Actions';
import Dispatcher from '../Dispatcher';
import FocusStore from '../stores/FocusStore';
import Keys from '../Keys';
import NotesSelectionStore from '../stores/NotesSelectionStore';
import colors from '../colors';
import debounce from 'simple-debounce';
import performKeyboardNavigation from '../performKeyboardNavigation';

class ContentEditable extends React.Component {
  static propTypes = {
    note: React.PropTypes.object,
    onBlur: React.PropTypes.func,
    value: React.PropTypes.text,
  };

  _autosave = debounce(() => this._persistChanges(true), 5000);

  constructor(props) {
    super(props);
    this.state = {
      value: this.props.note.get('text'),
    };
  }

  componentDidMount() {
    FocusStore.on('change', this._updateFocus);
  }

  componentWillReceiveProps(nextProps) {
    // Check for note identity ('id') rather than using `===`. Attributes of a
    // note may change (for example, 'index' will change in response to
    // bubbling).
    if (nextProps.note.get('id') !== this.props.note.get('id')) {
      this._persistChanges();
      this.setState({
        value: nextProps.note.get('text'),
      });
    }
  }

  componentWillUnmount() {
    FocusStore.removeListener('change', this._updateFocus);
    this._persistChanges();
  }

  _getStyles() {
    const {config} = this.props;
    return {
      root: {
        background: colors.background,
        border: 0,
        fontFamily: config.noteFontFamily,
        fontSize: config.noteFontSize + 'px',
        minHeight: 'calc(100vh - 36px)',
        outline: 0,
        overflowWrap: 'break-word',
        padding: '8px',
        whiteSpace: 'pre-wrap',
        width: '100%',
      }
    };
  }

  _persistChanges(isAutosave = false: boolean) {
    if (!this._pendingSave && isAutosave) {
      // No need to complete the autosave; an eager save already happened.
      return;
    }

    const text = this.state.value;
    if (text !== this.props.note.get('text')) {
      Actions.noteTextChanged({
        index: this.props.note.get('index'),
        isAutosave,
        text,
      });
    }

    this._pendingSave = false;
  }

  @autobind
  _onBlur(event) {
    if (this.props.onBlur) {
      this.props.onBlur(event);
    }
    if (!Dispatcher.isDispatching()) {
      this._persistChanges();
    }
  }


  @autobind
  _onChange(event) {
    const index = NotesSelectionStore.selection.first();
    if (index) {
      // Not at top of list, so bubble note to top.
      Actions.noteBubbled(this.props.note.get('index'), index);
    }
    this.setState({value: event.currentTarget.value});
    this._pendingSave = true;
    this._autosave();
  }

  _onKeyDown(event) {
    // Prevent undesired fallthrough to `performKeyboardNavigation` for some
    // keys.
    switch (event.keyCode) {
      case Keys.DOWN:
      case Keys.UP:
        return;

      case Keys.ESCAPE:
        event.preventDefault();
        Actions.searchRequested('');
        Actions.omniBarFocused();
        Actions.allNotesDeselected();
        return;

      case Keys.J:
      case Keys.K:
        if (!event.metaKey) {
          return;
        }
        break;

       case Keys.TAB:
        // Prevent the <body> from becoming `document.activeElement`.
        if (!event.shiftKey) {
          event.preventDefault();
          Actions.omniBarFocused();
          return;
        }
        break;
    }

    performKeyboardNavigation(event);
  }

  @autobind
  _updateFocus() {
    if (FocusStore.focus === 'Note') {
      ReactDOM.findDOMNode(this).focus();
    }
  }

  render() {
    return (
      <textarea
        {...this.props}
        onBlur={this._onBlur}
        onChange={this._onChange}
        onKeyDown={this._onKeyDown}
        style={this._getStyles().root}
        value={this.state.value}
      />
    );
  }
}

function mapStateToProps({config}) {
  return {config};
}

export default connect(mapStateToProps)(ContentEditable);
