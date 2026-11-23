# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- `rename_project` command and MCP tool.
- Homepage: saved projects are kept in this browser and listed as cards, sorted by last modified or by name. You can create, rename, duplicate, delete and export a project, replace one from a file, or import a file as a new project. Each project has its own link.
- A lasting "Not saved in this browser" notice while the browser keeps no projects or a save fails, and a prompt before leaving a project whose last change is not saved.

### Changed

- An MCP save lays out only the steps still at the start position (0, 0) and keeps the steps the user moved.

- Edits run through the command layer; rejected edits and import problems are listed with their fixes; connections drawn in the app get UUID ids (import still accepts any id).

## [0.1.0] - 2026-11-22

### Added

- GitHub Pages deploy of the app.
- AI contract with the MCP server, so an AI client can read and edit a map through typed tools.
- Coded console diagnostics: one single-line JSON record per problem, with an error boundary and global handlers that code every crash.
