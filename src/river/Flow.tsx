import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import SentinelLogin from '../features/sentinel/SentinelLogin';

export const riverflow = createBrowserRouter([
  { path: '/', element: <App /> },
  {path: 'login', element: <SentinelLogin /> }
]);
