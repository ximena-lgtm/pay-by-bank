import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Superficie del comercio
import S1SelectPayment      from './screens/S1SelectPayment.jsx';
import S0PaymentMethods     from './screens/S0PaymentMethods.jsx';
import S4TripInProgress     from './screens/S4TripInProgress.jsx';
import S5TripComplete       from './screens/S5TripComplete.jsx';

// Superficie del iniciador (Telar)
import DataConsentView      from './telar/views/DataConsentView.jsx';
import PaymentConsentView   from './telar/views/PaymentConsentView.jsx';
import DirectoryView        from './telar/views/DirectoryView.jsx';
import LinkSuccessView      from './telar/views/LinkSuccessView.jsx';
import S3cPaymentProcessing from './screens/S3cPaymentProcessing.jsx';

// Superficie de la entidad financiera
import S2PhoneHome          from './screens/S2PhoneHome.jsx';
import S3aNuLogin           from './screens/S3aNuLogin.jsx';
import S3NuSCA              from './screens/S3NuSCA.jsx';

export default function App() {
  return (
    <div className="phone-shell">
      <div className="phone">
        <Routes>
          {/* Comercio */}
          <Route path="/"                       element={<S1SelectPayment />} />
          <Route path="/payment-methods"        element={<S0PaymentMethods />} />
          <Route path="/trip"                   element={<S4TripInProgress />} />
          <Route path="/complete"               element={<S5TripComplete />} />

          {/* Iniciador */}
          <Route path="/telar/directory"        element={<DirectoryView />} />
          <Route path="/telar/consent-data"     element={<DataConsentView />} />
          <Route path="/telar/consent-payment"  element={<PaymentConsentView />} />
          <Route path="/telar/linked"           element={<LinkSuccessView />} />
          <Route path="/processing"             element={<S3cPaymentProcessing />} />

          {/* Entidad financiera */}
          <Route path="/phone-home"             element={<S2PhoneHome />} />
          <Route path="/nu-login"               element={<S3aNuLogin />} />
          <Route path="/nu-auth"                element={<S3NuSCA />} />

          <Route path="*"                       element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
