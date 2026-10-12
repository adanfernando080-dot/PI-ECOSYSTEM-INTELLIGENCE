import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { DevHttpHost, electronHost } from './host.js';
import type { BtpHostBridge } from '../shared/ipc.js';
import './styles.css';
createRoot(document.getElementById('root')!).render(<App host={(window as unknown as { btpHost?: BtpHostBridge }).btpHost ? electronHost((window as unknown as { btpHost: BtpHostBridge }).btpHost) : DevHttpHost} />);
