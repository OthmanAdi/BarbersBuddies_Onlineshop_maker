// EditableText Component
import React, {useEffect, useRef, useState} from "react";
import {Check, Edit2, X} from "lucide-react";
import { sanitizeHTML } from '../utils/sanitize';

const EditableText = ({
                          value,
                          onChange,
                          isEditing,
                          className = "",
                          isRichText = false
                      }) => {
    const [editing, setEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    const inputRef = useRef(null);

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editing]);

    if (!isEditing) {
        if (isRichText) {
            return (
                <div
                    className={className}
                    dangerouslySetInnerHTML={{ __html: sanitizeHTML(value) }}
                />
            );
        }
        return <div className={className}>{value}</div>;
    }

    if (isRichText) {
        return (
            <div className="relative group">
                <div
                    className={`${className} ${editing ? 'hidden' : 'block'}`}
                    dangerouslySetInnerHTML={{ __html: sanitizeHTML(value) }}
                    onClick={() => setEditing(true)}
                />
                {editing ? (
                    <div className="relative">
            <textarea
                ref={inputRef}
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                className="textarea textarea-bordered w-full min-h-[100px]"
                onBlur={() => {
                    onChange(tempValue);
                    setEditing(false);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                        onChange(tempValue);
                        setEditing(false);
                    }
                }}
            />
                        <div className="absolute top-2 right-2 flex gap-2">
                            <button
                                onClick={() => {
                                    onChange(tempValue);
                                    setEditing(false);
                                }}
                                className="btn btn-circle btn-sm btn-success"
                            >
                                <Check className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => {
                                    setTempValue(value);
                                    setEditing(false);
                                }}
                                className="btn btn-circle btn-sm btn-error"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        className="absolute top-2 right-2 btn btn-circle btn-sm btn-primary opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setEditing(true)}
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="relative group">
            {editing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    className={`input input-bordered w-full ${className}`}
                    onBlur={() => {
                        onChange(tempValue);
                        setEditing(false);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            onChange(tempValue);
                            setEditing(false);
                        }
                    }}
                />
            ) : (
                <>
                    <div
                        className={className}
                        onClick={() => setEditing(true)}
                    >
                        {value}
                    </div>
                    <button
                        className="absolute top-1/2 -right-8 transform -translate-y-1/2 btn btn-circle btn-sm btn-ghost opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setEditing(true)}
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                </>
            )}
        </div>
    );
};

export default EditableText;