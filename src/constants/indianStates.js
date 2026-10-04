export const INDIAN_STATES = [
  { code: 'KL', name: 'Kerala' },
  { code: 'TN', name: 'Tamil Nadu' },
  { code: 'KA', name: 'Karnataka' },
  { code: 'MH', name: 'Maharashtra' },
  { code: 'DL', name: 'Delhi' },
  { code: 'AP', name: 'Andhra Pradesh' },
  { code: 'TS', name: 'Telangana' },
  { code: 'GA', name: 'Goa' },
  { code: 'GJ', name: 'Gujarat' },
  { code: 'HR', name: 'Haryana' },
  { code: 'HP', name: 'Himachal Pradesh' },
  { code: 'JK', name: 'Jammu and Kashmir' },
  { code: 'JH', name: 'Jharkhand' },
  { code: 'MP', name: 'Madhya Pradesh' },
  { code: 'OR', name: 'Odisha' },
  { code: 'PB', name: 'Punjab' },
  { code: 'RJ', name: 'Rajasthan' },
  { code: 'UP', name: 'Uttar Pradesh' },
  { code: 'WB', name: 'West Bengal' },
  { code: 'AS', name: 'Assam' },
  { code: 'BR', name: 'Bihar' },
  { code: 'CG', name: 'Chhattisgarh' },
  { code: 'UT', name: 'Uttarakhand' },
  { code: 'PY', name: 'Puducherry' },
  { code: 'CH', name: 'Chandigarh' },
];

export const getStateCode = (stateName) => {
  if (!stateName) return 'KL';
  const clean = stateName.trim().toLowerCase();
  const matched = INDIAN_STATES.find(
    (s) => s.name.toLowerCase() === clean || s.code.toLowerCase() === clean || clean.includes(s.name.toLowerCase())
  );
  if (matched) return matched.code;
  if (clean.length === 2) return clean.toUpperCase();
  return 'KL';
};

export const getStateName = (stateCodeOrName) => {
  if (!stateCodeOrName) return 'Kerala';
  const clean = stateCodeOrName.trim().toUpperCase();
  const matched = INDIAN_STATES.find(
    (s) => s.code === clean || s.name.toUpperCase() === clean
  );
  return matched ? matched.name : stateCodeOrName;
};

export const COUNTRIES_LIST = [
  { code: 'IN', name: 'India' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'QA', name: 'Qatar' },
  { code: 'OM', name: 'Oman' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'US', name: 'United States (US)' },
  { code: 'GB', name: 'United Kingdom (UK)' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'NP', name: 'Nepal' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'MV', name: 'Maldives' },
];

export const getCountryCode = (countryName) => {
  if (!countryName) return 'IN';
  const clean = countryName.trim().toLowerCase();
  const matched = COUNTRIES_LIST.find(
    (c) => c.name.toLowerCase() === clean || c.code.toLowerCase() === clean || clean.includes(c.name.toLowerCase())
  );
  if (matched) return matched.code;
  if (clean.length === 2) return clean.toUpperCase();
  return 'IN';
};

export const getCountryName = (codeOrName) => {
  if (!codeOrName) return 'India';
  const clean = codeOrName.trim().toUpperCase();
  const matched = COUNTRIES_LIST.find(
    (c) => c.code === clean || c.name.toUpperCase() === clean
  );
  return matched ? matched.name : codeOrName;
};
