import React from 'react';
import {motion} from 'framer-motion';

const EmployeeSelectionStep = ({
                                   employees,
                                   selectedServices,
                                   selectedEmployee,
                                   setSelectedEmployee,
                                   setStep,
                                   t,
                                   onSkip
                               }) => {
    console.log("EmployeeSelectionStep RENDERED WITH:", {
        employeesReceived: employees,
        employeeCount: employees?.length,
        firstEmployee: employees?.[0],
        selectedServices,
        selectedEmployee
    });

    if (!employees || employees.length === 0) {
        onSkip();
        return null;
    }

    return (
        <motion.div
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            className="card bg-base-100 shadow-xl"
        >
            <div className="card-body">
                <h2 className="card-title text-2xl mb-6">{t.selectEmployee}</h2>

                {/* Employee Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {employees.map((employee, index) => (
                        <motion.div
                            key={employee.id || index}
                            initial={{opacity: 0, scale: 0.95}}
                            animate={{opacity: 1, scale: 1}}
                            whileHover={{scale: 1.02}}
                            className={`
                                card bg-base-200 cursor-pointer transition-all
                                ${selectedEmployee?.id === employee.id ? 'ring-2 ring-primary ring-offset-2' : ''}
                            `}
                            onClick={() => {
                                console.log("Employee selected:", {
                                    fullEmployee: employee,
                                    id: employee.id,
                                    name: employee.name,
                                    expertise: employee.expertise,
                                    schedule: employee.schedule
                                });
                                setSelectedEmployee({
                                    id: employee.id,
                                    name: employee.name,
                                    expertise: employee.expertise,
                                    schedule: employee.schedule
                                });
                            }}
                        >
                            <div className="card-body p-4">
                                <div className="flex items-start gap-4">
                                    {/* Employee Image */}
                                    <div className="relative">
                                        <div className="w-20 h-20 rounded-lg overflow-hidden">
                                            <img
                                                src={employee.photo}
                                                alt={employee.name}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    console.log("Image failed to load for:", employee.name);
                                                    e.target.src = 'https://via.placeholder.com/80';
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Employee Info */}
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg">{employee.name}</h3>

                                        {/* Expertise Tags */}
                                        <div className="flex flex-wrap gap-1 my-1">
                                            {employee.expertise?.map((skill, idx) => (
                                                <span
                                                    key={idx}
                                                    className="badge badge-sm badge-primary badge-outline"
                                                >
                                                    {skill}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Schedule Info */}
                                        <div className="text-sm mt-2">
                                            <p className="text-base-content/70">
                                                Available hours today: {employee.schedule ?
                                                Object.keys(employee.schedule).join(", ") :
                                                "Schedule not available"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Navigation */}
                <div className="flex justify-between mt-6">
                    <button
                        className="btn btn-outline"
                        onClick={() => setStep(1)}
                    >
                        Back
                    </button>

                    <div className="flex gap-4">
                        <button
                            className="btn btn-outline"
                            onClick={() => {
                                console.log("Skipping employee selection");
                                setSelectedEmployee(null);
                                setStep(3);
                            }}
                        >
                            Skip Selection
                        </button>
                        <button
                            className="btn btn-primary"
                            disabled={!selectedEmployee}
                            onClick={() => {
                                console.log("Continuing with employee:", selectedEmployee);
                                setStep(3);
                            }}
                        >
                            Continue
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default EmployeeSelectionStep;