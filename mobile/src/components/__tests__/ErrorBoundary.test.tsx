import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import ErrorBoundary from '../ErrorBoundary';

function ThrowsOnRender(): React.ReactElement {
  throw new Error('boom');
}

function Safe(): React.ReactElement {
  return <Text>all good</Text>;
}

function renderWithAct(element: React.ReactElement): TestRenderer.ReactTestRenderer {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}

describe('ErrorBoundary', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    // React logs the caught error to console.error itself too, in addition to our
    // own componentDidCatch call — silence that noise without hiding assertions.
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  test('renders children normally when nothing throws', () => {
    const renderer = renderWithAct(
      <ErrorBoundary>
        <Safe />
      </ErrorBoundary>
    );
    expect(renderer.root.findByType(Text).props.children).toBe('all good');
  });

  test('shows the fallback UI when a child throws during render', () => {
    const renderer = renderWithAct(
      <ErrorBoundary>
        <ThrowsOnRender />
      </ErrorBoundary>
    );
    const texts = renderer.root.findAllByType(Text).map((n) => n.props.children);
    expect(texts).toContain('Something went wrong. Please try again.');
    expect(texts).toContain('Try again');
  });

  test('logs the caught error via console.error', () => {
    renderWithAct(
      <ErrorBoundary>
        <ThrowsOnRender />
      </ErrorBoundary>
    );
    expect(errorSpy).toHaveBeenCalledWith(
      '[ErrorBoundary] Caught a render error:',
      expect.any(Error),
      expect.anything()
    );
  });

  test('"Try again" clears the error and re-renders a working child', () => {
    let shouldThrow = true;
    function Flaky(): React.ReactElement {
      if (shouldThrow) throw new Error('boom');
      return <Text>recovered</Text>;
    }

    const renderer = renderWithAct(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>
    );
    expect(
      renderer.root.findAllByType(Text).map((n) => n.props.children)
    ).toContain('Something went wrong. Please try again.');

    // Fix the underlying problem, then tap "Try again" — mirrors what a real retry
    // does (e.g. a refetch that succeeds the second time).
    shouldThrow = false;
    const retryButton = renderer.root.findByType(TouchableOpacity);
    act(() => {
      retryButton.props.onPress();
    });

    expect(renderer.root.findByType(Text).props.children).toBe('recovered');
  });
});
