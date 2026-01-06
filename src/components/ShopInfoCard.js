import React from 'react';
import { sanitizeHTML } from '../utils/sanitize';

const ShopInfoCard = ({shop, t}) => {
    return (<div className="card bg-base-100 shadow-xl">
            <div className="card-body">
                <h2 className="card-title mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20"
                         fill="currentColor">
                        <path fillRule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                              clipRule="evenodd"/>
                    </svg>
                    {t.aboutUs}
                </h2>

                <style>
                    {`
                        .shop-description {
                            font-family: Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                        }
                        .shop-description h1 {
                            color: #2c5282;
                            font-size: 28px;
                            margin-bottom: 16px;
                        }
                        .shop-description h2 {
                            color: #2c5282;
                            font-size: 24px;
                            margin-bottom: 16px;
                        }
                        .shop-description h3 {
                            color: #4a5568;
                            font-size: 20px;
                            margin: 16px 0 8px 0;
                        }
                        .shop-description ul {
                            margin-left: 20px;
                            margin-bottom: 16px;
                            list-style-type: disc;
                        }
                        .shop-description li {
                            margin-bottom: 8px;
                        }
                        .shop-description p {
                            margin-bottom: 16px;
                        }
                    `}
                </style>
                <div className="shop-description prose max-w-none"
                     dangerouslySetInnerHTML={{__html: sanitizeHTML(shop.biography)}}/>

                <div className="space-y-3">
                    <a href={`https://maps.google.com/?q=${shop.address}`} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-3 hover:text-primary transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20"
                             fill="currentColor">
                            <path fillRule="evenodd"
                                  d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                                  clipRule="evenodd"/>
                        </svg>
                        <span>{shop.address}</span>
                    </a>

                    <a href={`tel:${shop.phoneNumber}`}
                       className="flex items-center gap-3 hover:text-primary transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20"
                             fill="currentColor">
                            <path
                                d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                        </svg>
                        <span>{shop.phoneNumber}</span>
                    </a>

                    <a href={`mailto:${shop.email}`}
                       className="flex items-center gap-3 hover:text-primary transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20"
                             fill="currentColor">
                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                        </svg>
                        <span>{shop.email}</span>
                    </a>
                </div>
            </div>
        </div>);
}
export default ShopInfoCard;