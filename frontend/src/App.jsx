import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import S1SelectPayment      from './screens/S1SelectPayment.jsx';
import S1bSelectBank        from './screens/S1bSelectBank.jsx';
import S2PhoneHome          from './screens/S2PhoneHome.jsx';
import S2bNuPaymentDetails  from './screens/S2bNuPaymentDetails.jsx';
import S2HubConsent         from './screens/S2HubConsent.jsx';
import S3aNuLogin           from './screens/S3aNuLogin.jsx';
import S3NuSCA              from './screens/S3NuSCA.jsx';
import S3cPaymentProcessing from './screens/S3cPaymentProcessing.jsx';
import S4TripInProgress     from './screens/S4TripInProgress.jsx';
import S5TripComplete       from './screens/S5TripComplete.jsx';

export default function App() {
  return (
    <div className="phone-shell">
      <div className="phone">
        <Routes>
          <Route path="/"                     element={<S1SelectPayment />} />
          <Route path="/banks"                element={<S1bSelectBank />} />
          <Route path="/phone-home"           element={<S2PhoneHome />} />
          <Route path="/nu-payment-details"   element={<S2bNuPaymentDetails />} />
          <Route path="/consent"              element={<S2HubConsent />} />
          <Route path="/nu-login"             element={<S3aNuLogin />} />
          <Route path="/nu-payment-auth"      element={<S3NuSCA />} />
          <Route path="/auth"                 element={<S3NuSCA />} />
          <Route path="/processing"           element={<S3cPaymentProcessing />} />
          <Route path="/trip"                 element={<S4TripInProgress />} />
          <Route path="/complete"             element={<S5TripComplete />} />
          <Route path="*"                     element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
