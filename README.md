# Absurdly True?

A quiz game built like a tabloid front page. You get 10 strange claims about history, nature and space. Stamp each one **True** or **Fake**, read the real story, and build streaks for bonus points.

Built with React 19, TypeScript and Vite. There is no backend. Your best score is saved in `localStorage`.

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Scripts

| Script               | What it does                               |
| -------------------- | ------------------------------------------ |
| `npm run dev`        | Start the dev server with hot reload        |
| `npm run build`      | Type-check, then build to `dist/`           |
| `npm run preview`    | Serve the production build locally          |
| `npm run typecheck`  | Run the TypeScript compiler only            |
| `npm test`           | Run the unit tests once (Vitest)            |
| `npm run test:watch` | Run the tests in watch mode                 |

`typecheck`, `test` and `build` all run without interaction and exit non-zero on failure, so they are ready to use as CI/CD pipeline steps.

## Project structure

```
src/
├── main.tsx              # Entry point
├── App.tsx               # Switches between start / playing / finished screens
├── components/           # Presentational React components
│   ├── Masthead.tsx
│   ├── StartScreen.tsx
│   ├── QuestionScreen.tsx
│   ├── ProgressTrack.tsx
│   ├── Stamp.tsx
│   └── ResultScreen.tsx
├── game/                 # Game logic, kept free of UI
│   ├── types.ts          # Shared types
│   ├── logic.ts          # Pure reducer, scoring, ranks, shuffle
│   ├── logic.test.ts     # Unit tests for the logic
│   ├── useQuiz.ts        # React hook wrapping the reducer
│   └── bestScore.ts      # localStorage persistence
├── data/
│   └── questions.ts      # The question bank
└── styles/
    └── global.css        # Design tokens and all styles
```

## How scoring works

- A correct answer is worth **100** points.
- Each further correct answer in a row adds **+25**, up to a maximum of **+100** (200 points per claim).
- A wrong answer resets the streak.
- Your rank depends on how many claims you got right: Editor-in-Chief, Fact Checker, Staff Reporter, Intern or Tabloid Believer.

## Adding questions

Add an entry to `src/data/questions.ts`:

```ts
{
  id: 'unique-id',
  claim: 'The statement shown to the player.',
  isTrue: true,
  explanation: 'The real story, shown after the player answers.',
}
```

Each game picks 10 questions at random, so the bank needs at least 10. A test checks this.
