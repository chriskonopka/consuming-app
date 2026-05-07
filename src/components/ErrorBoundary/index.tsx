import { Component, ReactNode } from 'react';
import { appInsights } from '../../appInsights';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    appInsights?.trackException({ exception: error });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <p>Something went wrong.</p>;
    }
    return this.props.children;
  }
}
