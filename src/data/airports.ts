import { AirportInfo } from '../types/circadian';

export const AIRPORTS: Record<string, AirportInfo> = {
  // Primary Indian Hubs (IndiGo)
  DEL: { iata: 'DEL', name: 'Indira Gandhi International', city: 'Delhi', country: 'India', tzOffset: 5.5 },
  BOM: { iata: 'BOM', name: 'Chhatrapati Shivaji Maharaj', city: 'Mumbai', country: 'India', tzOffset: 5.5 },
  BLR: { iata: 'BLR', name: 'Kempegowda International', city: 'Bengaluru', country: 'India', tzOffset: 5.5 },
  HYD: { iata: 'HYD', name: 'Rajiv Gandhi International', city: 'Hyderabad', country: 'India', tzOffset: 5.5 },
  CCU: { iata: 'CCU', name: 'Netaji Subhash Chandra Bose', city: 'Kolkata', country: 'India', tzOffset: 5.5 },
  MAA: { iata: 'MAA', name: 'Chennai International', city: 'Chennai', country: 'India', tzOffset: 5.5 },
  AMD: { iata: 'AMD', name: 'Sardar Vallabhbhai Patel', city: 'Ahmedabad', country: 'India', tzOffset: 5.5 },
  GOI: { iata: 'GOI', name: 'Dabolim / Manohar International', city: 'Goa', country: 'India', tzOffset: 5.5 },
  PNQ: { iata: 'PNQ', name: 'Pune Airport', city: 'Pune', country: 'India', tzOffset: 5.5 },
  COK: { iata: 'COK', name: 'Cochin International', city: 'Kochi', country: 'India', tzOffset: 5.5 },
  GAU: { iata: 'GAU', name: 'Lokpriya Gopinath Bordoloi', city: 'Guwahati', country: 'India', tzOffset: 5.5 },
  TRV: { iata: 'TRV', name: 'Thiruvananthapuram International', city: 'Trivandrum', country: 'India', tzOffset: 5.5 },
  IXC: { iata: 'IXC', name: 'Chandigarh International', city: 'Chandigarh', country: 'India', tzOffset: 5.5 },

  // Middle East Hubs (IndiGo, Emirates, Etihad)
  DXB: { iata: 'DXB', name: 'Dubai International', city: 'Dubai', country: 'UAE', tzOffset: 4 },
  AUH: { iata: 'AUH', name: 'Zayed International Airport', city: 'Abu Dhabi', country: 'UAE', tzOffset: 4 },
  DOH: { iata: 'DOH', name: 'Hamad International Airport', city: 'Doha', country: 'Qatar', tzOffset: 3 },
  MCT: { iata: 'MCT', name: 'Muscat International', city: 'Muscat', country: 'Oman', tzOffset: 4 },
  BAH: { iata: 'BAH', name: 'Bahrain International', city: 'Manama', country: 'Bahrain', tzOffset: 3 },
  KWI: { iata: 'KWI', name: 'Kuwait International', city: 'Kuwait City', country: 'Kuwait', tzOffset: 3 },
  RUH: { iata: 'RUH', name: 'King Khalid International', city: 'Riyadh', country: 'Saudi Arabia', tzOffset: 3 },
  JED: { iata: 'JED', name: 'King Abdulaziz International', city: 'Jeddah', country: 'Saudi Arabia', tzOffset: 3 },

  // Southeast Asia & Far East (IndiGo, Emirates)
  SIN: { iata: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore', tzOffset: 8 },
  BKK: { iata: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand', tzOffset: 7 },
  HKT: { iata: 'HKT', name: 'Phuket International', city: 'Phuket', country: 'Thailand', tzOffset: 7 },
  KUL: { iata: 'KUL', name: 'Kuala Lumpur International', city: 'Kuala Lumpur', country: 'Malaysia', tzOffset: 8 },
  MLE: { iata: 'MLE', name: 'Velana International', city: 'Malé', country: 'Maldives', tzOffset: 5 },
  CMB: { iata: 'CMB', name: 'Bandaranaike International', city: 'Colombo', country: 'Sri Lanka', tzOffset: 5.5 },
  HAN: { iata: 'HAN', name: 'Noi Bai International', city: 'Hanoi', country: 'Vietnam', tzOffset: 7 },

  // Europe & Americas (Emirates, Etihad, IndiGo codeshare)
  LHR: { iata: 'LHR', name: 'London Heathrow', city: 'London', country: 'UK', tzOffset: 1 }, // BST/GMT avg
  CDG: { iata: 'CDG', name: 'Charles de Gaulle', city: 'Paris', country: 'France', tzOffset: 2 }, // CEST avg
  FRA: { iata: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', tzOffset: 2 },
  IST: { iata: 'IST', name: 'Istanbul Airport', city: 'Istanbul', country: 'Turkey', tzOffset: 3 },
  JFK: { iata: 'JFK', name: 'John F. Kennedy International', city: 'New York', country: 'USA', tzOffset: -4 },
  ORD: { iata: 'ORD', name: 'O\'Hare International', city: 'Chicago', country: 'USA', tzOffset: -5 },
  SFO: { iata: 'SFO', name: 'San Francisco International', city: 'San Francisco', country: 'USA', tzOffset: -7 },
  SYD: { iata: 'SYD', name: 'Sydney Kingsford Smith', city: 'Sydney', country: 'Australia', tzOffset: 10 },
};

export function getAirport(iata: string): AirportInfo {
  const code = iata.trim().toUpperCase();
  if (AIRPORTS[code]) {
    return AIRPORTS[code];
  }
  return {
    iata: code,
    name: `${code} Airport`,
    city: code,
    country: 'International',
    tzOffset: 0,
  };
}
