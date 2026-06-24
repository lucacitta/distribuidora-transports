# Generador de hojas de ruta · Pulqui

App web para armar las hojas de ruta de los choferes y copiarlas listas para WhatsApp.

## Stack
- Next.js 16 (App Router) + React 19
- Tailwind CSS v4
- Persistencia: hoy `localStorage`; próximamente Google Sheets vía Service Account (backend en API routes).

## Desarrollo
```bash
npm install
npm run dev    # http://localhost:3000
```

## Estructura
- `app/` — layout, página y estilos globales.
- `components/Generador.jsx` — la app (formulario de paradas, libreta, consolidado).
- `libreta_pulqui.json` — datos reales de la libreta (clientes/direcciones) para sembrar el Sheet.

## Notas
- `key.json` (clave de la Service Account) está en `.gitignore` y **nunca** debe commitearse.
- En la integración con Sheets, los datos se sincronizarán en tiempo real (la libreta y la agenda dejan de necesitar importar/exportar manual).
