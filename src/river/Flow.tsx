import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import SentinelLogin from '../features/sentinel/SentinelLogin';
import SentinelUserRegistration from '../features/sentinel/SentinelUserRegistration';
import SentinelUserUpdate from '../features/sentinel/SentinelUserUpdate';

export const riverflow = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: 'login', element: <SentinelLogin /> },
  { path: 'register', element: <SentinelUserRegistration /> },
  { path: 'update', element: <SentinelUserUpdate /> },
]);
