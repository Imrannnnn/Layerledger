global.IS_REACT_ACT_ENVIRONMENT = true;

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import App, { ErrorBoundary } from "./App";

// Mock child components to isolate App routing & ErrorBoundary
jest.mock("./components/home/HomePage.jsx", () => {
  const React = require("react");
  return {
    HomePage: () => <div data-testid="home-page">Home Page Content</div>,
    default: () => <div data-testid="home-page">Home Page Content</div>
  };
});

jest.mock("./components/landing/FreePackPage.jsx", () => {
  const React = require("react");
  return {
    FreePackPage: () => <div data-testid="free-pack-page">Free Baker Pack Page</div>,
    default: () => <div data-testid="free-pack-page">Free Baker Pack Page</div>
  };
});

describe("App & ErrorBoundary Tests", () => {
  let container, root;
  const originalLocation = window.location;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    // Suppress console.error in tests where ErrorBoundary catches expected errors
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (root) {
      act(() => { root.unmount(); });
      root = null;
    }
    document.body.removeChild(container);
    container = null;
    console.error.mockRestore();
  });

  test("1. ErrorBoundary catches component error and displays programmer fix message without mentioning Claude", () => {
    function BrokenComponent() {
      throw new Error("Simulated failure in test");
    }

    act(() => {
      root = createRoot(container);
      root.render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );
    });

    expect(container.textContent).toContain("Something Went Wrong");
    expect(container.textContent).toContain("The programmer will investigate and fix this bug");
    expect(container.textContent).toContain("Reload Page");
    expect(container.textContent).toContain("Go to Home");
    expect(container.textContent).not.toMatch(/claude/i);
    expect(container.textContent).not.toContain("share this error with Claude");
  });

  test("2. App component initializes and mounts cleanly on root URL without TDZ ReferenceErrors", async () => {
    delete window.location;
    window.location = new URL("https://bakewealthinternational.com/");

    await act(async () => {
      root = createRoot(container);
      root.render(
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      );
    });

    // Should not crash into ErrorBoundary
    expect(container.textContent).not.toContain("Something Went Wrong");
    expect(container.textContent).not.toContain("ReferenceError");
    expect(container.textContent).not.toContain("Cannot access");
  });

  test("3. App component mounts cleanly on /free-pack route without ReferenceErrors", async () => {
    delete window.location;
    window.location = new URL("https://bakewealthinternational.com/free-pack");

    await act(async () => {
      root = createRoot(container);
      root.render(
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      );
    });

    expect(container.textContent).not.toContain("Something Went Wrong");
    expect(container.textContent).not.toContain("ReferenceError");
  });
});
