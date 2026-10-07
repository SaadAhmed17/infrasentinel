// The project team, as shown on the About page (and the README).
export const SUPERVISOR = 'Dr. Quratulain Zahid';

export const TEAM = [
  {
    name: 'Saad Ahmed',
    role: 'Backend and SIEM engine (team lead)',
    work:
      'Led the team and built the backend. Set up the monorepo (Next.js web app, NestJS API and FastAPI AI service) and the first CI pipeline, then the API itself: sign-in with refresh tokens and role-based access, organizations and invitations, server registration with agent keys, and metric ingestion. Designed the SIEM engine with its six rule types and the grouping of alerts into incidents. Also wrote the Python monitoring and SSH log agents, the LSTM autoencoder with per-server training and live scoring, and the RAG assistant with pgvector search.',
  },
  {
    name: 'Farhan Ali',
    role: 'Frontend and dashboard',
    work:
      'Built the first designed version of the web console: the shared sidebar and profile menu, the light and dark mode toggle, and reusable form and badge components. Restyled the sign-in and sign-up pages, the dashboard, the servers and server detail pages, the rules page, the incidents page with its expandable alert list, and the assistant page. Later built the public website: the new home page, the shared navbar and footer, and the Services (now Features) and Contact pages.',
  },
  {
    name: 'Hashim Ahmed Khan',
    role: 'Quality assurance, security and UI design',
    work:
      'Led software quality assurance. Built the automated test suite (over 500 tests across the API, AI service and agents) and the CI test jobs, found and documented 54 defects, and fixed most of them. The fixes include security issues (agent key exposure, role escalation, tenant isolation, a shared secret between the API and the AI service), SIEM detection bugs (alerts after resolve, cross-tenant events, alert correlation), anomaly-model training fixes, and the forgot-password flow. Also redesigned the whole web interface, including the new logo, the light and dark themes, and every page.',
  },
];
