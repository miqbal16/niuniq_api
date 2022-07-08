const indonesia = require('territory-indonesia');
const colors = require('colors');
const path = require('path');
const fs = require('fs');

const getIndonesiaTerritory = async () => {
  const provinces = await indonesia.getAllProvinces();
  const regencies = await indonesia.getAllRegencies();
  const data = {};
  data.provinces = provinces.map((val) => val.name);
  data.regencies = regencies.map((val) => val.name);
  fs.writeFileSync(path.join(__dirname, '..', '_data', 'indonesiaTerritory.json'), JSON.stringify(data));
  console.log('File indonesian territory has been created'.yellow.inverse);
  process.exit();
};

getIndonesiaTerritory();
