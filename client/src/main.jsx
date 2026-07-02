/**
 * main.jsx — application entry point.
 * Renders the root <App/> into <div id="root"> from index.html.
 * <ErrorBoundary> catches render errors and shows a friendly message instead
 * of a blank white screen.
 */
import React from 'react'
import { createRoot } from 'react-dom/client'
import App, { ErrorBoundary } from './App.jsx'

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
