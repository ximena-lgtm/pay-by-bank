import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './S3cPaymentProcessing.css';

export default function S3cPaymentProcessing() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [molId, setMolId] = useState('');
  const [bank, setBank] = useState(null);
  const [amount, setAmount] = useState('18.500');

  useEffect(() => {
    // Leer información del banco y monto
    const bankStr = sessionStorage.getItem('selectedBank');
    const instrumentStr = sessionStorage.getItem('instrument');

    if (bankStr) {
      setBank(JSON.parse(bankStr));
    }
    if (instrumentStr) {
      const instrument = JSON.parse(instrumentStr);
      setAmount(instrument.amount?.toLocaleString('es-CO') || '18.500');
    }

    // Generar MOL ID único
    const generatedMolId = `MOL-${Date.now().toString().slice(-8)}`;
    setMolId(generatedMolId);

    // Simular progreso de pasos
    const stepTimings = [1000, 2000, 2000, 1500]; // Tiempo para cada paso

    stepTimings.forEach((delay, index) => {
      setTimeout(() => {
        setCurrentStep(index + 1);
      }, stepTimings.slice(0, index + 1).reduce((a, b) => a + b, 0));
    });
  }, []);

  const steps = [
    {
      id: 1,
      title: 'Debitando fondos',
      description: bank ? `Desde ${bank.name} · Cta *8834` : 'Desde tu cuenta',
      color: bank?.color || '#8A05BE',
    },
    {
      id: 2,
      title: 'Enviando a Bre-B',
      description: 'Red de pagos interbancarios',
      color: '#0066CC',
    },
    {
      id: 3,
      title: 'Aprobando crédito',
      description: 'Bancolombia · Cuenta Uber',
      color: '#00A650',
    },
    {
      id: 4,
      title: 'Confirmación',
      description: `MOL ID: ${molId}`,
      color: '#00C853',
    },
  ];

  function handleContinue() {
    navigate('/trip');
  }

  if (!bank) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="processing-screen">
      {/* Header */}
      <div className="processing-header">
        <div className="processing-amount">COP {amount}</div>
        <div className="processing-subtitle">Procesando pago</div>
      </div>

      {/* Steps */}
      <div className="processing-steps">
        {steps.map((step, index) => {
          const isCompleted = currentStep >= step.id;
          const isCurrent = currentStep === step.id - 1;
          const isPending = currentStep < step.id - 1;

          return (
            <div
              key={step.id}
              className={`processing-step ${
                isCompleted ? 'completed' : isCurrent ? 'current' : 'pending'
              }`}
            >
              {/* Connector line */}
              {index > 0 && (
                <div className={`step-connector ${isCompleted ? 'completed' : ''}`} />
              )}

              {/* Step content */}
              <div className="step-circle" style={{
                borderColor: isCompleted ? step.color : '#e0e0e0',
                backgroundColor: isCompleted ? step.color : 'white'
              }}>
                {isCompleted ? (
                  <span className="step-checkmark-icon">✓</span>
                ) : (
                  <span className="step-number">{step.id}</span>
                )}
              </div>

              <div className="step-content">
                <div className="step-title" style={{
                  color: isCompleted ? '#1d1d1f' : '#999'
                }}>
                  {step.title}
                </div>
                <div className="step-description" style={{
                  color: isCompleted ? '#666' : '#ccc'
                }}>
                  {step.description}
                </div>

                {/* Loading indicator for current step */}
                {isCurrent && (
                  <div className="step-loading">
                    <div className="loading-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                )}

                {/* Success checkmark for completed steps */}
                {isCompleted && step.id < 4 && (
                  <div className="step-checkmark">✓</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer with continue button */}
      {currentStep >= 4 && (
        <div className="processing-footer">
          <div className="success-message">
            <div className="success-icon">✓</div>
            <div className="success-text">
              <div className="success-title">Pago aprobado</div>
              <div className="success-subtitle">
                Liquidado vía Bre-B · MOL ID {molId}
              </div>
            </div>
          </div>

          <button
            className="btn-primary continue-btn"
            onClick={handleContinue}
            style={{ backgroundColor: bank.color }}
          >
            Continuar
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      )}

    </div>
  );
}
