/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta base del semaforo (se refinara en el modulo de grilla)
        estado: {
          ok: '#16a34a',
          justo: '#eab308',
          hueco: '#dc2626',
          critico: '#991b1b',
          conflicto: '#f97316',
          franco: '#e5e7eb',
          vacaciones: '#dbeafe',
          licencia: '#ddd6fe',
        },
      },
    },
  },
  plugins: [],
}
