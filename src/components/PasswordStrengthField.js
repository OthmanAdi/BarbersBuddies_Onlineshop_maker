import React, {useEffect, useState} from 'react';
import {Check, Key, Shield, ShieldAlert, ShieldCheck, X} from 'lucide-react';

const PasswordStrengthField = ({
                                   password,
                                   onChange,
                                   showPassword,
                                   setShowPassword,
                                   placeholder = "••••••••",
                                   className = ""
                               }) => {
    const [strength, setStrength] = useState(0);
    const [isFocused, setIsFocused] = useState(false);

    const requirements = [{re: /.{8,}/, label: 'At least 8 characters', met: false}, {
        re: /[0-9]/,
        label: 'At least 1 number',
        met: false
    }, {re: /[a-z]/, label: 'At least 1 lowercase letter', met: false}, {
        re: /[A-Z]/,
        label: 'At least 1 uppercase letter',
        met: false
    }, {re: /[^A-Za-z0-9]/, label: 'At least 1 special character', met: false}];

    const calculateStrength = (pass) => {
        let score = 0;
        let metRequirements = requirements.map(req => {
            const isMet = req.re.test(pass);
            if (isMet) score++;
            return {...req, met: isMet};
        });

        return {score: (score / requirements.length) * 100, requirements: metRequirements};
    };

    useEffect(() => {
        const {score} = calculateStrength(password);
        setStrength(score);
    }, [password]);

    const getStrengthLabel = () => {
        if (strength === 0) return {label: 'Too Weak', color: 'text-red-500', icon: ShieldAlert};
        if (strength < 40) return {label: 'Weak', color: 'text-orange-500', icon: Shield};
        if (strength < 80) return {label: 'Good', color: 'text-yellow-500', icon: Shield};
        return {label: 'Strong', color: 'text-green-500', icon: ShieldCheck};
    };

    const strengthInfo = getStrengthLabel();

    return (<div className="space-y-2">
            <div className="relative group">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Key className="h-5 w-5 text-gray-400"/>
                </div>

                <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    className={`block w-full pl-10 pr-12 py-2.5 rounded-xl text-gray-900 dark:text-white
            bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700
            focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            transition-all duration-200 ${className}`}
                    placeholder={placeholder}
                />

                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 flex items-center"
                >
                    {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 hover:text-gray-600"
                             viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                            <path fillRule="evenodd"
                                  d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/>
                        </svg>) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 hover:text-gray-600"
                             viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd"
                                  d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"/>
                            <path
                                d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>
                        </svg>)}
                </button>
            </div>

            {/* Strength Indicator */}
            {password && (<div className={`transition-all duration-300 ${isFocused ? 'opacity-100' : 'opacity-70'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <strengthInfo.icon className={`h-4 w-4 ${strengthInfo.color}`}/>
                            <span className={`text-sm font-medium ${strengthInfo.color}`}>
                {strengthInfo.label}
              </span>
                        </div>
                        <span className="text-xs text-gray-400">
              {strength.toFixed(0)}% Strong
            </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-300 rounded-full ${strength < 40 ? 'bg-red-500' : strength < 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{width: `${strength}%`}}
                        />
                    </div>

                    {/* Requirements */}
                    <div className="mt-3 space-y-2">
                        {calculateStrength(password).requirements.map((req, index) => (
                            <div key={index} className="flex items-center gap-2">
                                {req.met ? (<Check className="h-4 w-4 text-green-500"/>) : (
                                    <X className="h-4 w-4 text-red-500"/>)}
                                <span
                                    className={`text-sm ${req.met ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                  {req.label}
                </span>
                            </div>))}
                    </div>
                </div>)}
        </div>);
};

export default PasswordStrengthField;