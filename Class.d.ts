import { Component } from 'react';

export default class KeepAwake extends Component {
  /** Acquire the Class family's implicit request, distinct from root functions. */
  static activate(): void;
  /** Release only the Class implicit request. Repeated calls are harmless. */
  static deactivate(): void;
}
