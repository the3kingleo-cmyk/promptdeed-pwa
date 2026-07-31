'use strict';

// Representative Home Depot store IDs across the US
// Each entry: { id, name, city, state, zip }
// The scraper uses these by default; users can add more via ZIP lookup.
const DEFAULT_STORES = [
  // ALABAMA
  { id: '0701', name: 'Birmingham AL', city: 'Birmingham', state: 'AL', zip: '35244' },
  { id: '0702', name: 'Montgomery AL', city: 'Montgomery', state: 'AL', zip: '36117' },
  // ARIZONA
  { id: '0471', name: 'Phoenix AZ - East', city: 'Phoenix', state: 'AZ', zip: '85032' },
  { id: '0472', name: 'Phoenix AZ - West', city: 'Phoenix', state: 'AZ', zip: '85033' },
  { id: '0470', name: 'Tucson AZ', city: 'Tucson', state: 'AZ', zip: '85713' },
  { id: '0478', name: 'Scottsdale AZ', city: 'Scottsdale', state: 'AZ', zip: '85254' },
  { id: '0481', name: 'Mesa AZ', city: 'Mesa', state: 'AZ', zip: '85206' },
  // ARKANSAS
  { id: '0521', name: 'Little Rock AR', city: 'Little Rock', state: 'AR', zip: '72204' },
  // CALIFORNIA
  { id: '0602', name: 'Los Angeles CA - Burbank', city: 'Burbank', state: 'CA', zip: '91505' },
  { id: '0603', name: 'Los Angeles CA - Culver City', city: 'Culver City', state: 'CA', zip: '90232' },
  { id: '0611', name: 'San Diego CA - Kearny Mesa', city: 'San Diego', state: 'CA', zip: '92111' },
  { id: '0616', name: 'San Francisco CA - Potrero', city: 'San Francisco', state: 'CA', zip: '94107' },
  { id: '0620', name: 'San Jose CA', city: 'San Jose', state: 'CA', zip: '95128' },
  { id: '0621', name: 'Sacramento CA - Natomas', city: 'Sacramento', state: 'CA', zip: '95834' },
  { id: '0637', name: 'Fresno CA', city: 'Fresno', state: 'CA', zip: '93710' },
  { id: '6632', name: 'Oakland CA', city: 'Oakland', state: 'CA', zip: '94621' },
  { id: '0651', name: 'Anaheim CA', city: 'Anaheim', state: 'CA', zip: '92806' },
  { id: '0653', name: 'Long Beach CA', city: 'Long Beach', state: 'CA', zip: '90813' },
  { id: '0604', name: 'Riverside CA', city: 'Riverside', state: 'CA', zip: '92504' },
  // COLORADO
  { id: '1502', name: 'Denver CO - Aurora', city: 'Aurora', state: 'CO', zip: '80012' },
  { id: '1503', name: 'Denver CO - Lakewood', city: 'Lakewood', state: 'CO', zip: '80215' },
  { id: '1505', name: 'Colorado Springs CO', city: 'Colorado Springs', state: 'CO', zip: '80920' },
  // CONNECTICUT
  { id: '6230', name: 'Hartford CT - West Hartford', city: 'West Hartford', state: 'CT', zip: '06110' },
  { id: '6228', name: 'Bridgeport CT', city: 'Bridgeport', state: 'CT', zip: '06606' },
  // FLORIDA
  { id: '0247', name: 'Miami FL - North', city: 'Miami', state: 'FL', zip: '33169' },
  { id: '0248', name: 'Miami FL - South', city: 'Miami', state: 'FL', zip: '33183' },
  { id: '0250', name: 'Orlando FL - East', city: 'Orlando', state: 'FL', zip: '32826' },
  { id: '0251', name: 'Orlando FL - West', city: 'Orlando', state: 'FL', zip: '32808' },
  { id: '0262', name: 'Tampa FL - East', city: 'Tampa', state: 'FL', zip: '33619' },
  { id: '0263', name: 'Tampa FL - North', city: 'Tampa', state: 'FL', zip: '33612' },
  { id: '0270', name: 'Jacksonville FL', city: 'Jacksonville', state: 'FL', zip: '32256' },
  { id: '0276', name: 'Fort Lauderdale FL', city: 'Fort Lauderdale', state: 'FL', zip: '33319' },
  { id: '0280', name: 'Tallahassee FL', city: 'Tallahassee', state: 'FL', zip: '32303' },
  // GEORGIA
  { id: '0121', name: 'Atlanta GA - Marietta', city: 'Marietta', state: 'GA', zip: '30060' },
  { id: '0122', name: 'Atlanta GA - Tucker', city: 'Tucker', state: 'GA', zip: '30084' },
  { id: '0123', name: 'Atlanta GA - Smyrna', city: 'Smyrna', state: 'GA', zip: '30080' },
  { id: '0128', name: 'Savannah GA', city: 'Savannah', state: 'GA', zip: '31406' },
  { id: '0130', name: 'Augusta GA', city: 'Augusta', state: 'GA', zip: '30909' },
  // IDAHO
  { id: '3403', name: 'Boise ID', city: 'Boise', state: 'ID', zip: '83705' },
  // ILLINOIS
  { id: '1900', name: 'Chicago IL - Lincoln Park', city: 'Chicago', state: 'IL', zip: '60614' },
  { id: '1901', name: 'Chicago IL - South', city: 'Chicago', state: 'IL', zip: '60617' },
  { id: '8948', name: 'Chicago IL - Evergreen Park', city: 'Evergreen Park', state: 'IL', zip: '60805' },
  { id: '1910', name: 'Springfield IL', city: 'Springfield', state: 'IL', zip: '62704' },
  // INDIANA
  { id: '2001', name: 'Indianapolis IN - East', city: 'Indianapolis', state: 'IN', zip: '46219' },
  { id: '2003', name: 'Indianapolis IN - West', city: 'Indianapolis', state: 'IN', zip: '46241' },
  { id: '2010', name: 'Fort Wayne IN', city: 'Fort Wayne', state: 'IN', zip: '46804' },
  // IOWA
  { id: '2101', name: 'Des Moines IA', city: 'Des Moines', state: 'IA', zip: '50321' },
  // KANSAS
  { id: '2200', name: 'Wichita KS', city: 'Wichita', state: 'KS', zip: '67212' },
  { id: '2201', name: 'Kansas City KS - Overland Park', city: 'Overland Park', state: 'KS', zip: '66212' },
  // KENTUCKY
  { id: '2301', name: 'Louisville KY', city: 'Louisville', state: 'KY', zip: '40220' },
  { id: '2302', name: 'Lexington KY', city: 'Lexington', state: 'KY', zip: '40503' },
  // LOUISIANA
  { id: '0530', name: 'New Orleans LA', city: 'New Orleans', state: 'LA', zip: '70123' },
  { id: '0531', name: 'Baton Rouge LA', city: 'Baton Rouge', state: 'LA', zip: '70816' },
  // MARYLAND
  { id: '2401', name: 'Baltimore MD - Reisterstown', city: 'Baltimore', state: 'MD', zip: '21208' },
  { id: '2402', name: 'Baltimore MD - Dundalk', city: 'Baltimore', state: 'MD', zip: '21222' },
  // MASSACHUSETTS
  { id: '6139', name: 'Boston MA - Everett', city: 'Everett', state: 'MA', zip: '02149' },
  { id: '6140', name: 'Boston MA - Brighton', city: 'Brighton', state: 'MA', zip: '02135' },
  { id: '6141', name: 'Worcester MA', city: 'Worcester', state: 'MA', zip: '01606' },
  // MICHIGAN
  { id: '2501', name: 'Detroit MI - Dearborn', city: 'Dearborn', state: 'MI', zip: '48126' },
  { id: '2502', name: 'Detroit MI - Warren', city: 'Warren', state: 'MI', zip: '48091' },
  { id: '2510', name: 'Grand Rapids MI', city: 'Grand Rapids', state: 'MI', zip: '49512' },
  // MINNESOTA
  { id: '2601', name: 'Minneapolis MN - Bloomington', city: 'Bloomington', state: 'MN', zip: '55420' },
  { id: '2602', name: 'Minneapolis MN - St Paul', city: 'St. Paul', state: 'MN', zip: '55106' },
  // MISSISSIPPI
  { id: '0710', name: 'Jackson MS', city: 'Jackson', state: 'MS', zip: '39211' },
  // MISSOURI
  { id: '2700', name: 'Kansas City MO', city: 'Kansas City', state: 'MO', zip: '64134' },
  { id: '2701', name: 'St Louis MO - South', city: 'St. Louis', state: 'MO', zip: '63125' },
  { id: '2702', name: 'St Louis MO - West', city: 'St. Louis', state: 'MO', zip: '63141' },
  // NEVADA
  { id: '0482', name: 'Las Vegas NV - East', city: 'Las Vegas', state: 'NV', zip: '89121' },
  { id: '0483', name: 'Las Vegas NV - North', city: 'Las Vegas', state: 'NV', zip: '89030' },
  { id: '0484', name: 'Las Vegas NV - Henderson', city: 'Henderson', state: 'NV', zip: '89014' },
  { id: '0486', name: 'Reno NV', city: 'Reno', state: 'NV', zip: '89502' },
  // NEW JERSEY
  { id: '6231', name: 'Newark NJ - Linden', city: 'Linden', state: 'NJ', zip: '07036' },
  { id: '6232', name: 'Jersey City NJ', city: 'Jersey City', state: 'NJ', zip: '07305' },
  // NEW MEXICO
  { id: '0493', name: 'Albuquerque NM', city: 'Albuquerque', state: 'NM', zip: '87110' },
  // NEW YORK
  { id: '1233', name: 'New York NY - Manhattan 23rd', city: 'New York', state: 'NY', zip: '10001' },
  { id: '1232', name: 'New York NY - Brooklyn', city: 'Brooklyn', state: 'NY', zip: '11219' },
  { id: '1269', name: 'New York NY - Queens', city: 'Queens', state: 'NY', zip: '11385' },
  { id: '1248', name: 'New York NY - Bronx', city: 'Bronx', state: 'NY', zip: '10451' },
  { id: '1242', name: 'New York NY - Staten Island', city: 'Staten Island', state: 'NY', zip: '10314' },
  { id: '6239', name: 'Buffalo NY', city: 'Buffalo', state: 'NY', zip: '14220' },
  { id: '6240', name: 'Rochester NY', city: 'Rochester', state: 'NY', zip: '14623' },
  // NORTH CAROLINA
  { id: '0870', name: 'Charlotte NC - East', city: 'Charlotte', state: 'NC', zip: '28212' },
  { id: '0871', name: 'Charlotte NC - North', city: 'Charlotte', state: 'NC', zip: '28215' },
  { id: '0880', name: 'Raleigh NC', city: 'Raleigh', state: 'NC', zip: '27615' },
  { id: '0882', name: 'Greensboro NC', city: 'Greensboro', state: 'NC', zip: '27405' },
  { id: '0884', name: 'Durham NC', city: 'Durham', state: 'NC', zip: '27703' },
  // OHIO
  { id: '2801', name: 'Columbus OH - East', city: 'Columbus', state: 'OH', zip: '43228' },
  { id: '2802', name: 'Columbus OH - North', city: 'Columbus', state: 'OH', zip: '43214' },
  { id: '2811', name: 'Cleveland OH - Parma', city: 'Parma', state: 'OH', zip: '44130' },
  { id: '2812', name: 'Cleveland OH - Mayfield', city: 'Mayfield Heights', state: 'OH', zip: '44124' },
  { id: '2820', name: 'Cincinnati OH', city: 'Cincinnati', state: 'OH', zip: '45231' },
  // OKLAHOMA
  { id: '0540', name: 'Oklahoma City OK', city: 'Oklahoma City', state: 'OK', zip: '73132' },
  { id: '0541', name: 'Tulsa OK', city: 'Tulsa', state: 'OK', zip: '74133' },
  // OREGON
  { id: '3801', name: 'Portland OR - East', city: 'Portland', state: 'OR', zip: '97220' },
  { id: '3802', name: 'Portland OR - West', city: 'Beaverton', state: 'OR', zip: '97005' },
  { id: '3803', name: 'Eugene OR', city: 'Eugene', state: 'OR', zip: '97401' },
  // PENNSYLVANIA
  { id: '2651', name: 'Philadelphia PA - Northeast', city: 'Philadelphia', state: 'PA', zip: '19135' },
  { id: '2652', name: 'Philadelphia PA - South', city: 'Philadelphia', state: 'PA', zip: '19145' },
  { id: '2660', name: 'Pittsburgh PA - East', city: 'Pittsburgh', state: 'PA', zip: '15235' },
  { id: '2661', name: 'Pittsburgh PA - West', city: 'Pittsburgh', state: 'PA', zip: '15205' },
  // SOUTH CAROLINA
  { id: '0890', name: 'Columbia SC', city: 'Columbia', state: 'SC', zip: '29210' },
  { id: '0891', name: 'Charleston SC', city: 'Charleston', state: 'SC', zip: '29418' },
  // TENNESSEE
  { id: '0760', name: 'Nashville TN - Brentwood', city: 'Brentwood', state: 'TN', zip: '37027' },
  { id: '0761', name: 'Nashville TN - Antioch', city: 'Antioch', state: 'TN', zip: '37013' },
  { id: '0770', name: 'Memphis TN', city: 'Memphis', state: 'TN', zip: '38128' },
  { id: '0780', name: 'Knoxville TN', city: 'Knoxville', state: 'TN', zip: '37922' },
  // TEXAS
  { id: '0550', name: 'Houston TX - Westheimer', city: 'Houston', state: 'TX', zip: '77063' },
  { id: '0551', name: 'Houston TX - North', city: 'Houston', state: 'TX', zip: '77090' },
  { id: '0552', name: 'Houston TX - Humble', city: 'Humble', state: 'TX', zip: '77338' },
  { id: '0560', name: 'Dallas TX - LBJ', city: 'Dallas', state: 'TX', zip: '75237' },
  { id: '0561', name: 'Dallas TX - Garland', city: 'Garland', state: 'TX', zip: '75041' },
  { id: '0562', name: 'Dallas TX - Fort Worth', city: 'Fort Worth', state: 'TX', zip: '76133' },
  { id: '0570', name: 'San Antonio TX - South', city: 'San Antonio', state: 'TX', zip: '78221' },
  { id: '0571', name: 'San Antonio TX - North', city: 'San Antonio', state: 'TX', zip: '78213' },
  { id: '0580', name: 'Austin TX - South', city: 'Austin', state: 'TX', zip: '78748' },
  { id: '0581', name: 'Austin TX - North', city: 'Austin', state: 'TX', zip: '78758' },
  { id: '0590', name: 'El Paso TX', city: 'El Paso', state: 'TX', zip: '79925' },
  // UTAH
  { id: '3401', name: 'Salt Lake City UT - Murray', city: 'Murray', state: 'UT', zip: '84107' },
  { id: '3402', name: 'Salt Lake City UT - West Valley', city: 'West Valley City', state: 'UT', zip: '84119' },
  // VIRGINIA
  { id: '2960', name: 'Richmond VA', city: 'Richmond', state: 'VA', zip: '23234' },
  { id: '2961', name: 'Virginia Beach VA', city: 'Virginia Beach', state: 'VA', zip: '23452' },
  { id: '2962', name: 'Norfolk VA', city: 'Norfolk', state: 'VA', zip: '23513' },
  // WASHINGTON
  { id: '3900', name: 'Seattle WA - Sodo', city: 'Seattle', state: 'WA', zip: '98134' },
  { id: '3901', name: 'Seattle WA - Northgate', city: 'Seattle', state: 'WA', zip: '98125' },
  { id: '3902', name: 'Bellevue WA', city: 'Bellevue', state: 'WA', zip: '98005' },
  { id: '3910', name: 'Spokane WA', city: 'Spokane', state: 'WA', zip: '99216' },
  // WISCONSIN
  { id: '2901', name: 'Milwaukee WI', city: 'Milwaukee', state: 'WI', zip: '53219' },
  { id: '2902', name: 'Madison WI', city: 'Madison', state: 'WI', zip: '53713' },
];

module.exports = { DEFAULT_STORES };
