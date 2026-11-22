# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- Edits run through the command layer; rejected edits and import problems are listed with their fixes; new connection ids are UUIDs (import still accepts any id).

## [0.1.0] - 2026-11-22

### Added

- GitHub Pages deploy of the app.
- AI contract with the MCP server, so an AI client can read and edit a map through typed tools.
- Coded console diagnostics: one single-line JSON record per problem, with an error boundary and global handlers that code every crash.
