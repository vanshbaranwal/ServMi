# ServMi frontend

ServMi's React frontend uses Vite, Tailwind CSS, shadcn/ui, React Router, Axios, and Zustand.

## Run locally

1. Start the backend from `../backend` on port `5000`.
2. Install dependencies with `npm install`.
3. Start the frontend with `npm run dev`.

During development, Vite proxies `/api` requests to `http://localhost:5000`. For a deployed frontend, set `VITE_API_URL` to the backend origin.

## Source structure

```text
src/
├── components/      Shared application controls
│   └── ui/          shadcn/ui primitives
├── layout/          Marketing, booking, provider, and admin shells
├── lib/             API, navigation, and formatting helpers
├── page/            Route-level pages
└── store/           Shared Zustand state
```

This follows the folder naming used by the LeetSpase frontend while keeping ServMi's design and product logic independent.

## Checks

- `npm run lint`
- `npm run build`
