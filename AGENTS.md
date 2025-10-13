# Instructions

Read @README.md first.

## General

- Don't start making changes until instructed to do so
- Keep code simple, minimal, and DRY
- Keep variable names short
- Write modular, elegant code
- Don't add comments
- Use pure functions with explicit arguments
- Prefer early return over conditional
- Array properties should default to empty arrays, not `null`
- Prefer libraries' own types over writing your own
- Don't create classes (unless instructed)
- When researching APIs and docs, use latest content (2025)
- Put reusable/generic utility functions in separate files
- Never include backward compat code unless asked
- Clean up cruft after every task

## JavaScript & TypeScript

- Use yarn (not npm)
- Run yarn typecheck after changes to check for type errors
- Never use 'any' type
- Use function declaration style (`function foo() {...}`)
- Don't add try/catch blocks
- Don't throw; instead, console.warn() and return `null`
- Don't use optional?: function arguments or object properties
- Don't use default exports _unless necessary_

## React

- Modular, functional, strongly typed
- Create presentational components that just render props
  - Complex logical components should pass props to those presentational components
- Generic components go under web/components/
- Hooks go under web/hooks/
  - One hook per file
  - File named same as the hook
- Tailwind for styling
- Heroicons for icons
