import React, { useState, useRef, useEffect } from 'react';
import './SegmentedOTPInput.css';

const SegmentedOTPInput = ({ length = 6, value = '', onChange, disabled = false }) => {
  const [otpArray, setOtpArray] = useState(new Array(length).fill(''));
  const inputRefs = useRef([]);

  // Sync internal state with prop value if it changes externally
  useEffect(() => {
    if (value) {
      const newArray = value.split('').slice(0, length);
      while (newArray.length < length) newArray.push('');
      setOtpArray(newArray);
    } else {
      setOtpArray(new Array(length).fill(''));
    }
  }, [value, length]);

  const handleChange = (index, e) => {
    const val = e.target.value;
    if (isNaN(val)) return;

    const newOtpArray = [...otpArray];
    // Take only the last character entered
    newOtpArray[index] = val.substring(val.length - 1);
    setOtpArray(newOtpArray);
    
    const combinedOtp = newOtpArray.join('');
    if (onChange) onChange(combinedOtp);

    // Focus next input
    if (val && index < length - 1) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpArray[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text/plain').trim();
    if (isNaN(pasteData)) return;

    const newOtpArray = pasteData.split('').slice(0, length);
    while (newOtpArray.length < length) newOtpArray.push('');
    setOtpArray(newOtpArray);

    const combinedOtp = newOtpArray.join('');
    if (onChange) onChange(combinedOtp);

    // Focus last filled or the one after
    const focusIndex = Math.min(pasteData.length, length - 1);
    inputRefs.current[focusIndex].focus();
  };

  return (
    <div className="segmented-otp-container">
      {otpArray.map((digit, index) => (
        <input
          key={index}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          ref={(el) => (inputRefs.current[index] = el)}
          value={digit}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className="segmented-otp-input"
          maxLength={1}
        />
      ))}
    </div>
  );
};

export default SegmentedOTPInput;
