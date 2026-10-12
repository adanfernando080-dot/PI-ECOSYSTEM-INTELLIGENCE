import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { DevHttpHost } from './host.js';
import './styles.css';
createRoot(document.getElementById('root')!).render(<App host={DevHttpHost} />);
