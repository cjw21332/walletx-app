const { useState, useEffect, useRef } = React

const initialLocations = [
  { id: 1, name: 'Manila, Philippines', lat: 14.5995, lon: 120.9842 },
  { id: 2, name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { id: 3, name: 'London', lat: 51.5074, lon: -0.1278 },
  { id: 4, name: 'New York', lat: 40.7128, lon: -74.0060 },
  { id: 5, name: 'Dubai', lat: 25.2048, lon: 55.2708 }
]

// Local storage helpers
const loadFromStorage = (key, defaultValue) => {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  } catch {
    return defaultValue
  }
}

const saveToStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error('Storage error:', e)
  }
}

function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [locations, setLocations] = useState(initialLocations)
  const [selectedLocation, setSelectedLocation] = useState(initialLocations[0])
  const [weather, setWeather] = useState(null)
  const [daily, setDaily] = useState([])
  const [hourly, setHourly] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [manageSearch, setManageSearch] = useState('')
  
  // Features
  const [favorites, setFavorites] = useState(() => loadFromStorage('favorites', []))
  const [searchHistory, setSearchHistory] = useState(() => loadFromStorage('searchHistory', []))
  const [tempUnit, setTempUnit] = useState(() => loadFromStorage('tempUnit', 'C'))
  const [speedUnit, setSpeedUnit] = useState(() => loadFromStorage('speedUnit', 'km/h'))
  const [showSettings, setShowSettings] = useState(false)
  const [theme, setTheme] = useState(() => loadFromStorage('theme', 'dark'))
  const [aqi, setAqi] = useState(null)
  const [aqiLabel, setAqiLabel] = useState('')
  const [uvIndex, setUvIndex] = useState(null)
  const [sunTimes, setSunTimes] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [expandedAlert, setExpandedAlert] = useState(null)
  const [weatherDetails, setWeatherDetails] = useState(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareLocation, setCompareLocation] = useState(null)
  const [compareWeather, setCompareWeather] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)

  useEffect(() => {
    requestLocationPermission()
  }, [])

  useEffect(() => {
    if (selectedLocation && selectedLocation.lat && selectedLocation.lon) {
      loadWeather(selectedLocation)
    }
  }, [selectedLocation, tempUnit])

  useEffect(() => {
    saveToStorage('favorites', favorites)
    saveToStorage('tempUnit', tempUnit)
    saveToStorage('speedUnit', speedUnit)
    saveToStorage('theme', theme)
  }, [favorites, tempUnit, speedUnit, theme])

  const requestLocationPermission = () => {
    if (!navigator.geolocation) {
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          name: 'Current Location'
        }
        setSelectedLocation(coords)
      },
      () => {
        // Geolocation denied or unavailable; continue using default Philippines location.
      }
    )
  }

  const convertTemp = (celsius) => {
    if (tempUnit === 'F') return Math.round((celsius * 9/5) + 32)
    if (tempUnit === 'K') return Math.round(celsius + 273.15)
    return Math.round(celsius)
  }

  const convertSpeed = (kmh) => {
    if (speedUnit === 'mph') return Math.round(kmh * 0.621371)
    if (speedUnit === 'm/s') return Math.round(kmh / 3.6)
    if (speedUnit === 'knots') return Math.round(kmh * 0.539957)
    return Math.round(kmh)
  }

  const getSpeedUnit = () => {
    const units = { 'km/h': 'km/h', 'mph': 'mph', 'm/s': 'm/s', 'knots': 'knots' }
    return units[speedUnit] || 'km/h'
  }

  const getTempUnit = () => {
    const units = { 'C': '°C', 'F': '°F', 'K': 'K' }
    return units[tempUnit] || '°C'
  }

  const loadWeather = async (location) => {
    setLoading(true)
    setError('')
    setAlerts([])

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current_weather=true&hourly=temperature_2m,weathercode,relativehumidity_2m,windspeed_10m,winddirection_10m,apparent_temperature,pressure_msl,visibility&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max,sunrise,sunset,uv_index_max,precipitation_sum,windspeed_10m_max&timezone=auto`
      const response = await fetch(url)
      const data = await response.json()
      
      const today = new Date(data.current_weather.time)
      const windDir = data.current_weather.winddirection_10m || 0
      
      const weatherData = {
        ...data.current_weather,
        location: location.name,
        updated: today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        windDirection: windDir,
        apparentTemp: Math.round(data.hourly.apparent_temperature[0]),
        humidity: Math.round(data.hourly.relativehumidity_2m[0]),
        pressure: Math.round(data.hourly.pressure_msl[0]),
        visibility: Math.round(data.hourly.visibility[0] / 1000)
      }
      setWeather(weatherData)
      setLastUpdated(new Date())
      
      // Calculate AQI
      const aqiValue = estimateAQI(weatherData.temperature, data.current_weather.weathercode)
      setAqi(aqiValue.index)
      setAqiLabel(aqiValue.label)

      // Get UV Index from daily data
      if (data.daily.uv_index_max && data.daily.uv_index_max.length > 0) {
        setUvIndex(Math.round(data.daily.uv_index_max[0] * 10) / 10)
      }

      // Get sunrise and sunset
      if (data.daily.sunrise && data.daily.sunset) {
        setSunTimes({
          sunrise: new Date(data.daily.sunrise[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sunset: new Date(data.daily.sunset[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        })
      }

      const dailyForecast = data.daily.time.map((date, index) => ({
        date,
        max: data.daily.temperature_2m_max[index],
        min: data.daily.temperature_2m_min[index],
        code: data.daily.weathercode[index],
        rain: data.daily.precipitation_probability_max[index],
        uv: Math.round(data.daily.uv_index_max[index] * 10) / 10,
        precipitation: Math.round(data.daily.precipitation_sum[index] * 10) / 10,
        windSpeed: Math.round(data.daily.windspeed_10m_max[index])
      }))
      setDaily(dailyForecast.slice(0, 10))

      const hourlyForecast = data.hourly.time.slice(0, 24).map((time, index) => ({
        time,
        temp: data.hourly.temperature_2m[index],
        code: data.hourly.weathercode[index],
        windDir: data.hourly.winddirection_10m[index],
        windSpeed: data.hourly.windspeed_10m[index],
        humidity: data.hourly.relativehumidity_2m[index],
        apparentTemp: data.hourly.apparent_temperature[index]
      }))
      setHourly(hourlyForecast)

      // Set weather details
      setWeatherDetails({
        pressure: weatherData.pressure,
        visibility: weatherData.visibility,
        humidity: weatherData.humidity,
        dewPoint: calculateDewPoint(weatherData.temperature, weatherData.humidity),
        windGust: Math.max(...hourlyForecast.map(h => h.windSpeed))
      })

      // Generate alerts based on weather conditions
      generateAlerts(data.current_weather.weathercode, dailyForecast, data.current_weather.temperature)
    } catch (err) {
      setError('Unable to load weather. Try again.')
      console.error(err)
    }

    setLoading(false)
  }

  const calculateDewPoint = (temp, humidity) => {
    const a = 17.27
    const b = 237.7
    const alpha = ((a * temp) / (b + temp)) + Math.log(humidity / 100)
    const dewPoint = (b * alpha) / (a - alpha)
    return Math.round(dewPoint)
  }

  const estimateAQI = (temp, weatherCode) => {
    const baseAqi = {
      0: 1, 1: 1, 2: 2, 3: 2, 45: 4, 48: 4,
      51: 2, 53: 2, 55: 2, 56: 3, 57: 3, 61: 3,
      63: 3, 65: 4, 66: 4, 67: 4, 71: 3, 73: 3,
      75: 4, 77: 3, 80: 3, 81: 4, 82: 4, 85: 4,
      86: 4, 95: 5, 96: 5, 99: 5
    }
    
    const index = baseAqi[weatherCode] || 2
    const labels = {
      1: 'Good',
      2: 'Fair',
      3: 'Moderate',
      4: 'Poor',
      5: 'Very Poor'
    }
    
    return { index, label: labels[index] }
  }

  const generateAlerts = (weatherCode, forecast, temperature) => {
    const newAlerts = []
    
    // Severe weather
    if (weatherCode >= 95) {
      newAlerts.push({ 
        type: '⛈️', 
        message: 'Severe Thunderstorm Warning',
        severity: 'critical',
        description: 'Dangerous thunderstorms with severe lightning expected. Take shelter immediately.' 
      })
    }
    
    // Heavy rain
    if (weatherCode >= 80 && weatherCode <= 82) {
      newAlerts.push({ 
        type: '🌧️', 
        message: 'Heavy Rain Alert',
        severity: 'high',
        description: 'Heavy rainfall expected. Be cautious on roads and avoid flooding areas.' 
      })
    }
    
    // Snow
    if (weatherCode >= 71 && weatherCode <= 86) {
      newAlerts.push({ 
        type: '❄️', 
        message: 'Snow Warning',
        severity: 'high',
        description: 'Heavy snow conditions expected. Drive with caution.' 
      })
    }
    
    // Extreme heat
    if (temperature > 38) {
      newAlerts.push({ 
        type: '🔥', 
        message: 'Extreme Heat Warning',
        severity: 'high',
        description: 'Dangerously high temperatures. Stay hydrated and avoid prolonged sun exposure.' 
      })
    }
    
    // Extreme cold
    if (temperature < -15) {
      newAlerts.push({ 
        type: '❄️', 
        message: 'Extreme Cold Warning',
        severity: 'high',
        description: 'Dangerously low temperatures. Frostbite risk. Limit outdoor activities.' 
      })
    }
    
    // Future precipitation
    if (forecast.some(day => day.rain > 80)) {
      newAlerts.push({ 
        type: '💧', 
        message: 'High Precipitation Probability',
        severity: 'medium',
        description: 'Very high chance of rain in the coming days.' 
      })
    }
    
    // High UV
    const maxUv = forecast[0]?.uv || 0
    if (maxUv > 8) {
      newAlerts.push({ 
        type: '☀️', 
        message: 'Extreme UV Index',
        severity: 'medium',
        description: 'UV index is very high. Wear sunscreen and protective clothing.' 
      })
    }
    
    setAlerts(newAlerts)
  }

  const getWeatherIcon = (code) => {
    const icons = {
      0: 'fas fa-sun',
      1: 'fas fa-sun',
      2: 'fas fa-cloud-sun',
      3: 'fas fa-cloud',
      45: 'fas fa-smog',
      48: 'fas fa-smog',
      51: 'fas fa-cloud-rain',
      53: 'fas fa-cloud-rain',
      55: 'fas fa-cloud-rain',
      56: 'fas fa-snowflake',
      57: 'fas fa-snowflake',
      61: 'fas fa-cloud-rain',
      63: 'fas fa-cloud-rain',
      65: 'fas fa-cloud-rain',
      66: 'fas fa-snowflake',
      67: 'fas fa-snowflake',
      71: 'fas fa-snowflake',
      73: 'fas fa-snowflake',
      75: 'fas fa-snowflake',
      77: 'fas fa-snowflake',
      80: 'fas fa-cloud-rain',
      81: 'fas fa-cloud-showers-heavy',
      82: 'fas fa-cloud-showers-heavy',
      85: 'fas fa-snowflake',
      86: 'fas fa-snowflake',
      95: 'fas fa-bolt',
      96: 'fas fa-bolt',
      99: 'fas fa-bolt'
    }
    return icons[code] || 'fas fa-question'
  }

  const getUtilityIcon = (name) => {
    const icons = {
      'location': 'fas fa-map-marker-alt',
      'temperature': 'fas fa-thermometer-half',
      'wind': 'fas fa-wind',
      'humidity': 'fas fa-droplet',
      'time': 'fas fa-clock',
      'calendar': 'fas fa-calendar-days',
      'add': 'fas fa-plus',
      'manage': 'fas fa-sliders',
      'error': 'fas fa-exclamation-circle',
      'star': 'fas fa-star',
      'settings': 'fas fa-sliders',
      'compare': 'fas fa-balance-scale',
      'details': 'fas fa-circle-info',
      'pressure': 'fas fa-arrow-down',
      'eye': 'fas fa-eye',
      'water': 'fas fa-droplet',
      'wind-dir': 'fas fa-compass'
    }
    return icons[name] || 'fas fa-circle'
  }

  const getWeatherLabel = (code) => {
    const labels = {
      0: 'Clear', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
      45: 'Fog', 48: 'Fog', 51: 'Light Drizzle', 53: 'Moderate Drizzle',
      55: 'Dense Drizzle', 56: 'Freezing Drizzle', 57: 'Freezing Drizzle',
      61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain', 66: 'Freezing Rain',
      67: 'Freezing Rain', 71: 'Snow', 73: 'Snow', 75: 'Heavy Snow',
      77: 'Snow Grains', 80: 'Light Showers', 81: 'Showers',
      82: 'Heavy Showers', 85: 'Light Snow', 86: 'Heavy Snow',
      95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm'
    }
    return labels[code] || 'Unknown'
  }

  const getWindDirection = (degrees) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
    const index = Math.round(((degrees % 360) / 22.5)) % 16
    return directions[index]
  }

  const getUVProtectionTips = (uv) => {
    if (uv <= 2) return 'Low UV exposure. Sunscreen optional.'
    if (uv <= 5) return 'Moderate UV. Apply SPF 30+ sunscreen.'
    if (uv <= 7) return 'High UV. Wear hat and sunglasses.'
    if (uv <= 10) return 'Very High UV. Limit sun exposure.'
    return 'Extreme UV. Avoid sun if possible.'
  }

  const getAlertIcon = (alertType) => {
    const icons = {
      '⛈️': 'fas fa-bolt',
      '🌧️': 'fas fa-cloud-rain',
      '❄️': 'fas fa-snowflake',
      '🔥': 'fas fa-fire',
      '💧': 'fas fa-droplet',
      '☀️': 'fas fa-sun'
    }
    return icons[alertType] || 'fas fa-exclamation-circle'
  }

  const toggleFavorite = (location) => {
    setFavorites((prev) => {
      const isFav = prev.some(fav => fav.id === location.id)
      if (isFav) {
        return prev.filter(fav => fav.id !== location.id)
      } else {
        return [...prev, location]
      }
    })
  }

  const isFavorite = (location) => {
    return favorites.some(fav => fav.id === location.id)
  }

  const handleLocationSelect = (location) => {
    setSelectedLocation(location)
    setActiveTab('home')
    setCompareMode(false)
  }

  const handleCompare = (location) => {
    setCompareLocation(location)
    setCompareMode(!compareMode)
    loadComparisonWeather(location)
  }

  const loadComparisonWeather = async (location) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current_weather=true`
      const response = await fetch(url)
      const data = await response.json()
      setCompareWeather({
        ...data.current_weather,
        location: location.name
      })
    } catch (err) {
      console.error('Comparison load error:', err)
    }
  }

  const handleAddLocation = async () => {
    if (!manageSearch.trim()) return
    setLoading(true)
    setError('')

    try {
      const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(manageSearch)}&count=1`)
      const geoData = await geoResponse.json()
      if (geoData.results && geoData.results.length > 0) {
        const result = geoData.results[0]
        const newLocation = {
          id: Date.now(),
          name: `${result.name}${result.admin1 ? ', ' + result.admin1 : ''}${result.country ? ', ' + result.country : ''}`,
          lat: result.latitude,
          lon: result.longitude
        }
        setLocations((prev) => [newLocation, ...prev])
        setSearchHistory((prev) => [newLocation, ...prev].slice(0, 5))
        setSelectedLocation(newLocation)
        setManageSearch('')
        setActiveTab('home')
      } else {
        setError('City not found. Try another search.')
      }
    } catch (err) {
      setError('Unable to add location. Try again.')
    }

    setLoading(false)
  }

  const handleRemoveLocation = (id) => {
    setLocations((prev) => prev.filter(loc => loc.id !== id))
  }

  const onTouchStart = (e) => {
    touchStartX.current = e.changedTouches[0].screenX
  }

  const onTouchEnd = (e) => {
    touchEndX.current = e.changedTouches[0].screenX
    handleSwipe()
  }

  const handleSwipe = () => {
    const diff = touchStartX.current - touchEndX.current
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        // Swiped left
        if (activeTab === 'home') setActiveTab('locations')
        else if (activeTab === 'locations') setActiveTab('forecast')
      } else {
        // Swiped right
        if (activeTab === 'forecast') setActiveTab('locations')
        else if (activeTab === 'locations') setActiveTab('home')
      }
    }
  }

  const tempFeels = weather ? `${convertTemp(weather.temperature)}${getTempUnit()}` : '--'
  const currentLabel = weather ? getWeatherLabel(weather.weathercode) : ''

  const renderAlerts = () => {
    if (alerts.length === 0) return null
    return (
      <div className="mb-6 space-y-3 animate-fadeIn">
        {alerts.map((alert, idx) => (
          <div 
            key={idx} 
            onClick={() => setExpandedAlert(expandedAlert === idx ? null : idx)}
            className={`rounded-2xl p-4 sm:p-5 cursor-pointer transition-all border ${
              alert.severity === 'critical' ? 'border-red-500/50 bg-red-500/10' :
              alert.severity === 'high' ? 'border-orange-500/50 bg-orange-500/10' :
              'border-yellow-500/40 bg-yellow-500/5'
            }`}
          >
            <div className="flex items-start gap-3">
              <Icon className={`text-xl flex-shrink-0 ${getAlertIcon(alert.type)}`} />
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm sm:text-base ${
                  alert.severity === 'critical' ? 'text-red-300' :
                  alert.severity === 'high' ? 'text-orange-300' :
                  'text-yellow-300'
                }`}>{alert.message}</p>
                {expandedAlert === idx && (
                  <p className="text-xs sm:text-sm text-slate-300 mt-2">{alert.description}</p>
                )}
              </div>
              <span className="text-slate-400 flex-shrink-0">{expandedAlert === idx ? '▼' : '▶'}</span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderOverview = () => (
    <>
      <header className="flex flex-col gap-4 sm:gap-5 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 fade-in">
        <div>
          <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-sky-300/75 font-medium">WeatherSnap</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-2">Real time delivery of weather on your Phone</h1>
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-400/10 px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-purple-200 transition-all hover:bg-purple-400/20 active:scale-95"
          >
            <Icon className={`text-lg ${getUtilityIcon('settings')}`} />
            <span className="hidden sm:inline">Settings</span>
          </button>
          <button
            onClick={() => setActiveTab('locations')}
            className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-sky-200 transition-all hover:bg-sky-400/20 active:scale-95"
          >
            <Icon className={`text-lg ${getUtilityIcon('location')}`} />
            <span className="hidden sm:inline">Manage</span>
          </button>
        </div>
      </header>

      {renderAlerts()}

      {showSettings && (
        <div className="glass-card rounded-2xl border border-white/10 p-5 sm:p-6 mb-6 slide-in-up fade-in">
          <h3 className="text-lg sm:text-xl font-bold text-white mb-4">Settings</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs sm:text-sm text-slate-300 font-medium block mb-2">Temperature Unit</label>
              <select 
                value={tempUnit} 
                onChange={(e) => setTempUnit(e.target.value)}
                className="w-full rounded-lg bg-slate-950/60 border border-white/10 text-white text-sm px-3 py-2 focus:border-sky-400/50"
              >
                <option value="C">Celsius (°C)</option>
                <option value="F">Fahrenheit (°F)</option>
                <option value="K">Kelvin (K)</option>
              </select>
            </div>
            <div>
              <label className="text-xs sm:text-sm text-slate-300 font-medium block mb-2">Speed Unit</label>
              <select 
                value={speedUnit} 
                onChange={(e) => setSpeedUnit(e.target.value)}
                className="w-full rounded-lg bg-slate-950/60 border border-white/10 text-white text-sm px-3 py-2 focus:border-sky-400/50"
              >
                <option value="km/h">km/h</option>
                <option value="mph">mph</option>
                <option value="m/s">m/s</option>
                <option value="knots">knots</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden rounded-3xl border border-white/10 p-5 sm:p-8 shadow-2xl hover-lift slide-in-up">
        <div className="grid gap-6 sm:gap-8 sm:grid-cols-[1.4fr_1fr] sm:items-center">
          <div>
            <p className="text-xs sm:text-sm uppercase tracking-[0.35em] text-sky-200/70 font-semibold">Current Weather</p>
            <h2 className="mt-2 sm:mt-3 text-3xl sm:text-5xl font-bold text-white break-words">{selectedLocation.name}</h2>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-slate-300 font-medium">{weather ? currentLabel : 'Loading latest conditions...'}</p>
          </div>
          <div className="rounded-3xl bg-gradient-to-br from-sky-500/10 to-blue-600/10 p-6 sm:p-8 text-center">
            <div className="weather-icon-lg text-6xl sm:text-7xl"><Icon className={getWeatherIcon(weather?.weathercode)} /></div>
            <p className="mt-3 sm:mt-4 text-xs uppercase tracking-[0.35em] text-slate-300 font-semibold">Current Conditions</p>
          </div>
        </div>

        <div className="mt-6 sm:mt-8 grid gap-4 sm:grid-cols-4">
          <StatCard icon={getUtilityIcon('temperature')} label="Temperature" value={weather ? `${convertTemp(weather.temperature)}${getTempUnit()}` : '--'} />
          <StatCard icon={getUtilityIcon('wind')} label="Wind Speed" value={weather ? `${convertSpeed(weather.windspeed)} ${getSpeedUnit()}` : '--'} />
          <StatCard icon={getUtilityIcon('humidity')} label="Humidity" value={weather ? `${weather.humidity}%` : '--'} />
          <StatCard icon={getUtilityIcon('time')} label="Feels Like" value={weather ? `${convertTemp(weather.apparentTemp)}${getTempUnit()}` : '--'} />
        </div>

        <div className="mt-6 sm:mt-8 grid gap-3 sm:grid-cols-3">
          <StatCard icon={getUtilityIcon('pressure')} label="Pressure" value={weatherDetails ? `${weatherDetails.pressure} hPa` : '--'} />
          <StatCard icon={getUtilityIcon('eye')} label="Visibility" value={weatherDetails ? `${weatherDetails.visibility} km` : '--'} />
          <StatCard icon={getUtilityIcon('wind-dir')} label="Wind Direction" value={weather ? `${getWindDirection(weather.windDirection)} ${weather.windDirection}°` : '--'} />
        </div>

        {sunTimes && (
          <div className="mt-6 sm:mt-8 grid gap-3 sm:grid-cols-2 rounded-2xl border border-white/10 bg-slate-950/30 p-4 sm:p-6">
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400 font-medium"><Icon className="fas fa-sunrise mr-2" />Sunrise</p>
              <p className="mt-2 text-lg sm:text-xl font-bold text-white">{sunTimes.sunrise}</p>
            </div>
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400 font-medium"><Icon className="fas fa-sunset mr-2" />Sunset</p>
              <p className="mt-2 text-lg sm:text-xl font-bold text-white">{sunTimes.sunset}</p>
            </div>
          </div>
        )}

        {aqi !== null && uvIndex !== null && (
          <div className="mt-6 sm:mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 sm:p-6">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400 font-medium mb-2">Air Quality Index</p>
              <div className="flex items-end gap-3">
                <p className={`text-3xl sm:text-4xl font-bold ${
                  aqi <= 2 ? 'text-green-400' : aqi <= 3 ? 'text-yellow-400' : aqi <= 4 ? 'text-orange-400' : 'text-red-400'
                }`}>{aqi}</p>
                <p className="text-sm sm:text-base text-slate-300 mb-1">{aqiLabel}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 sm:p-6">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400 font-medium mb-2">UV Index</p>
              <div className="flex items-end gap-3">
                <p className={`text-3xl sm:text-4xl font-bold ${
                  uvIndex <= 2 ? 'text-green-400' : uvIndex <= 5 ? 'text-yellow-400' : uvIndex <= 7 ? 'text-orange-400' : 'text-red-400'
                }`}>{uvIndex}</p>
              </div>
              <p className="text-xs text-slate-400 mt-2">{getUVProtectionTips(uvIndex)}</p>
            </div>
          </div>
        )}

        <div className="mt-6 sm:mt-8 rounded-2xl border border-white/10 bg-slate-950/30 p-4 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex items-center gap-2">
              <Icon className="fas fa-hourglass-end text-lg" />
              <span className="text-xs sm:text-sm font-semibold text-slate-300">24-Hour Forecast</span>
            </div>
          </div>
          <div className="overflow-x-auto pb-2 scroll-smooth flex gap-2 sm:grid sm:grid-cols-6 sm:overflow-visible">
            {hourly.slice(0, 12).map((hour, index) => (
              <div key={index} className="min-w-[85px] rounded-2xl border border-white/10 bg-slate-900/70 p-3 text-center hover-lift sm:min-w-0 transition-all">
                <p className="text-xs text-slate-400 font-medium">{new Date(hour.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                <div className="my-2 text-2xl"><Icon className={getWeatherIcon(hour.code)} /></div>
                <p className="text-xs sm:text-sm font-bold text-slate-200">{convertTemp(hour.temp)}${getTempUnit()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )

  const renderLocations = () => (
    <div className="glass-card rounded-3xl border border-white/10 p-6 sm:p-8 fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-sky-300/70 font-semibold flex items-center gap-2">
            <Icon className={`text-lg ${getUtilityIcon('location')}`} />
            Manage Locations
          </p>
          <h3 className="mt-3 text-3xl font-bold text-white">Your Saved Destinations</h3>
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={manageSearch}
            onChange={(e) => setManageSearch(e.target.value)}
            placeholder="Search for a city, region, or country..."
            className="flex-1 min-w-[180px] rounded-full border border-white/10 bg-slate-950/60 px-5 py-3 text-sm text-white outline-none placeholder:text-slate-500 transition focus:border-sky-400/50 focus:bg-slate-950/80"
            onKeyDown={(e) => e.key === 'Enter' && handleAddLocation()}
          />
          <button 
            onClick={handleAddLocation}
            disabled={loading}
            className="rounded-full bg-gradient-to-r from-sky-500 to-blue-500 px-6 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-sky-500/50 active:scale-95 disabled:opacity-50"
          >
            <Icon className={`mr-2 ${getUtilityIcon('add')}`} />Add
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => (
            <button
              key={location.id}
              onClick={() => handleLocationSelect(location)}
              className="group flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-950/70 p-5 text-left transition-all card-hover sm:flex-col"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Location</p>
                  <p className="mt-2 text-lg font-bold text-white">{location.name}</p>
                </div>
                <span className="text-xl opacity-0 group-hover:opacity-100 transition">→</span>
              </div>
              {location.name === selectedLocation.name && (
                <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-sky-500/20 border border-sky-500/30 px-3 py-1">
                  <Icon className="fas fa-check text-xs" />
                  <span className="text-xs font-semibold text-sky-200">Active</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  const renderForecast = () => (
    <div className="glass-card rounded-3xl border border-white/10 p-6 sm:p-8 fade-in">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.35em] text-sky-300/70 font-semibold flex items-center gap-2">
          <Icon className={`text-lg ${getUtilityIcon('calendar')}`} />
          7-Day Forecast
        </p>
        <h3 className="mt-3 text-3xl font-bold text-white">{selectedLocation.name}</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {daily.map((day) => (
          <div 
            key={day.date} 
            className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 shadow-inner shadow-slate-950/20 transition-all hover-lift"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">
                  {new Date(day.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                <p className="mt-2 text-sm font-semibold text-white">{getWeatherLabel(day.code)}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl">
                  <Icon className={getWeatherIcon(day.code)} />
                </div>
                <p className="mt-2 text-xs text-slate-400 font-medium">Rain</p>
                <p className="text-sm font-bold text-sky-300">{day.rain}%</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-red-400"><Icon className="fas fa-arrow-up" /></span>
                  <span className="text-sm font-bold text-white">{Math.round(day.max)}°</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-400"><Icon className="fas fa-arrow-down" /></span>
                  <span className="text-sm font-bold text-slate-300">{Math.round(day.min)}°</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-32 page-shell">
      <div className="mx-auto max-w-3xl px-4 pt-5 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-100 flex items-start gap-3 slide-in-up">
            <Icon className="fas fa-exclamation-triangle text-lg flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {activeTab === 'home' && renderOverview()}
        {activeTab === 'locations' && renderLocations()}
        {activeTab === 'forecast' && renderForecast()}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-slate-950/80 px-4 py-4 backdrop-blur-xl sm:px-8 shadow-2xl shadow-slate-900/50">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 sm:gap-4">
          <NavButton label="Overview" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
          <NavButton label="Locations" active={activeTab === 'locations'} onClick={() => setActiveTab('locations')} />
          <NavButton label="Forecast" active={activeTab === 'forecast'} onClick={() => setActiveTab('forecast')} />
        </div>
      </nav>
    </div>
  )
}

function StatCard({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-center transition-all hover-lift">
      <div className="flex items-center justify-center h-8 mb-2 text-xl">
        <Icon className={icon} />
      </div>
      <p className="text-xs uppercase tracking-[0.3em] text-slate-400 font-medium">{label}</p>
      <p className="mt-3 text-lg font-bold text-white">{value}</p>
    </div>
  )
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-full border px-4 py-3 text-sm font-semibold transition ${
        active ? 'border-sky-400 bg-slate-900/70 text-white' : 'border-white/10 bg-slate-950/70 text-slate-300 hover:border-slate-200/20'
      }`}
    >
      {label}
    </button>
  )
}

function Icon({ className, title }) {
  return <i className={className} title={title}></i>
}

function NavButton({ label, active, onClick }) {
  const icons = {
    'Overview': 'fas fa-sun',
    'Locations': 'fas fa-map-marker-alt',
    'Forecast': 'fas fa-calendar-days'
  }
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
        active ? 'bg-sky-400/20 text-sky-200 border border-sky-400/40' : 'text-slate-400 hover:text-slate-100 border border-transparent'
      }`}
    >
      <Icon className={`text-lg ${icons[label]}`} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<App />)
