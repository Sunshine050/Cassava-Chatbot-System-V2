// backend/services/weatherService.js
const axios = require('axios');

class WeatherService {
  constructor() {
    this.apiKey = process.env.OPENWEATHER_API_KEY;
    this.baseUrl = 'https://api.openweathermap.org/data/2.5';
  }

  // ดึงสภาพอากาศปัจจุบัน
  async getCurrentWeather(lat = 13.7563, lon = 100.5018) { // Default Bangkok
    try {
      if (!this.apiKey) {
        throw new Error('OpenWeather API key not configured');
      }

      const response = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          lat,
          lon,
          appid: this.apiKey,
          units: 'metric',
          lang: 'th'
        }
      });

      const weather = response.data;

      return {
        location: weather.name,
        temperature: weather.main.temp,
        humidity: weather.main.humidity,
        description: weather.weather[0].description,
        windSpeed: weather.wind?.speed || 0,
        pressure: weather.main.pressure,
        visibility: weather.visibility / 1000,
        sunrise: new Date(weather.sys.sunrise * 1000).toLocaleTimeString('th-TH'),
        sunset: new Date(weather.sys.sunset * 1000).toLocaleTimeString('th-TH'),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching weather data:', error);
      throw new Error('Failed to fetch weather information');
    }
  }

  // ดึงพยากรณ์อากาศล่วงหน้า
  async getWeatherForecast(lat = 13.7563, lon = 100.5018, days = 5) {
    try {
      if (!this.apiKey) {
        throw new Error('OpenWeather API key not configured');
      }

      const response = await axios.get(`${this.baseUrl}/forecast`, {
        params: {
          lat,
          lon,
          appid: this.apiKey,
          units: 'metric',
          cnt: days * 8,
          lang: 'th'
        }
      });

      const forecast = response.data;

      const dailyForecast = {};

      forecast.list.forEach(item => {
        const date = new Date(item.dt * 1000).toDateString();
        if (!dailyForecast[date]) {
          dailyForecast[date] = {
            date,
            temperatures: [],
            humidity: [],
            rainfall: 0,
            conditions: []
          };
        }

        dailyForecast[date].temperatures.push(item.main.temp);
        dailyForecast[date].humidity.push(item.main.humidity);
        dailyForecast[date].rainfall += item.rain?.['3h'] || 0;
        dailyForecast[date].conditions.push(item.weather[0].description);
      });

      const processedForecast = Object.values(dailyForecast).map(day => ({
        date: day.date,
        avgTemp: Math.round(day.temperatures.reduce((a, b) => a + b, 0) / day.temperatures.length),
        maxTemp: Math.round(Math.max(...day.temperatures)),
        minTemp: Math.round(Math.min(...day.temperatures)),
        avgHumidity: Math.round(day.humidity.reduce((a, b) => a + b, 0) / day.humidity.length),
        totalRainfall: Math.round(day.rainfall * 10) / 10,
        dominantCondition: day.conditions[0]
      }));

      return {
        location: forecast.city.name,
        forecast: processedForecast,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching weather forecast:', error);
      throw new Error('Failed to fetch weather forecast');
    }
  }

  // สร้างคำแนะนำการเกษตร
  generateFarmingAdvice(weatherData) {
    const advice = {
      irrigation: '',
      protection: '',
      harvesting: '',
      general: ''
    };

    const { temperature, humidity, description } = weatherData;

    if (humidity < 60) {
      advice.irrigation = 'ควรรดน้ำเพิ่มเติม เนื่องจากความชื้นต่ำ';
    } else if (humidity > 80) {
      advice.irrigation = 'ลดการรดน้ำ เนื่องจากความชื้นสูง อาจเกิดโรคราได้';
    }

    if (temperature > 35) {
      advice.protection = 'อุณหภูมิสูง ควรให้ร่มเงาและรักษาความชื้นในดิน';
    } else if (temperature < 18) {
      advice.protection = 'อุณหภูมิต่ำ ควรปกป้องต้นมันสำปะหลังจากความหนาว';
    }

    if (description.includes('ฝน')) {
      advice.general = 'มีฝนตก ระวังการระบายน้ำให้ดี เพื่อป้องกันรากเน่า';
    } else if (description.includes('แดด')) {
      advice.general = 'อากาศแจ่มใส เหมาะสำหรับการเจริญเติบโต';
    }

    return advice;
  }
}

module.exports = new WeatherService();
