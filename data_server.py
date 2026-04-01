import os
import time
import requests
import json
from datetime import datetime
from flask import Flask, jsonify, abort, request
from flask_cors import CORS
from dotenv import load_dotenv

from cities_db import STATES_CITIES

load_dotenv()

app = Flask(__name__)
CORS(app)

weather_cache = {}
CACHE_DURATION = 600  # 10 minutes

traffic_cache = {}
TRAFFIC_CACHE_DURATION = 300  # 5 minutes

@app.route('/api/cities', methods=['GET'])
def get_cities():
    result = {}
    for state, cities in STATES_CITIES.items():
        result[state] = list(cities.keys())
    return jsonify(result)

@app.route('/api/weather', methods=['GET'])
def get_weather():
    city = request.args.get('city', 'Jaipur')
    current_time = time.time()
    
    cache_key = f"weather_{city}"
    
    if cache_key not in weather_cache:
        weather_cache[cache_key] = {"data": None, "timestamp": 0}
        
    # Check if cache is valid (within 10 minutes)
    if weather_cache[cache_key]["data"] and (current_time - weather_cache[cache_key]["timestamp"] < CACHE_DURATION):
        return jsonify(weather_cache[cache_key]["data"])
        
    openweather_key = os.getenv("OPENWEATHER_API_KEY")
    waqi_key = os.getenv("WAQI_API_KEY")
    
    if not openweather_key or not waqi_key:
        if weather_cache[cache_key]["data"]:
            return jsonify(weather_cache[cache_key]["data"])
        return jsonify({"error": "API keys not configured"}), 503
        
    try:
        weather_url = f"https://api.openweathermap.org/data/2.5/weather?q={city},IN&appid={openweather_key}&units=metric"
        weather_res = requests.get(weather_url, timeout=10)
        weather_res.raise_for_status()
        weather_data = weather_res.json()
        
        waqi_city = city.lower().replace(" ", "-")
        waqi_url = f"https://api.waqi.info/feed/{waqi_city}/?token={waqi_key}"
        waqi_res = requests.get(waqi_url, timeout=10)
        waqi_res.raise_for_status()
        waqi_data = waqi_res.json()
        
        if waqi_data.get("status") != "ok":
            raise ValueError("WAQI API returned non-ok status")
            
        w_main = weather_data.get("main", {})
        temp = float(w_main.get("temp", 0.0))
        humidity = int(w_main.get("humidity", 0))
        
        condition = ""
        weather_list = weather_data.get("weather", [])
        if weather_list:
            condition = str(weather_list[0].get("description", ""))
            
        w_wind = weather_data.get("wind", {})
        wind_speed = float(w_wind.get("speed", 0.0))
        
        w_aqi_data = waqi_data.get("data", {})
        aqi = int(w_aqi_data.get("aqi", 0))
        
        iaqi = w_aqi_data.get("iaqi", {})
        pm25 = float(iaqi.get("pm25", {}).get("v", 0.0))
        no2 = float(iaqi.get("no2", {}).get("v", 0.0))
        
        result = {
            "temp": temp,
            "humidity": humidity,
            "condition": condition,
            "wind_speed": wind_speed,
            "aqi": aqi,
            "pm25": pm25,
            "no2": no2
        }
        
        weather_cache[cache_key]["data"] = result
        weather_cache[cache_key]["timestamp"] = current_time
        
        return jsonify(result)
        
    except Exception as e:
        if weather_cache[cache_key]["data"]:
            return jsonify(weather_cache[cache_key]["data"])
        return jsonify({"error": "Service unavailable"}), 503

@app.route('/api/traffic', methods=['GET'])
def get_traffic():
    city = request.args.get('city', 'Jaipur')
    current_time = time.time()
    
    cache_key = f"traffic_{city}"
    if cache_key not in traffic_cache:
        traffic_cache[cache_key] = {"data": None, "timestamp": 0}
    
    if traffic_cache[cache_key]["data"] and (current_time - traffic_cache[cache_key]["timestamp"] < TRAFFIC_CACHE_DURATION):
        return jsonify(traffic_cache[cache_key]["data"])
        
    tomtom_key = os.getenv("TOMTOM_API_KEY")
    if not tomtom_key:
        if traffic_cache[cache_key]["data"]:
            return jsonify(traffic_cache[cache_key]["data"])
        return jsonify({"error": "TOMTOM API key not configured"}), 503

    base_lat = 26.9124
    base_lon = 75.7873
    for s, c_dict in STATES_CITIES.items():
        if city in c_dict:
            base_lat = c_dict[city]["lat"]
            base_lon = c_dict[city]["lon"]
            break

    points = [
        {"name": "highway", "coords": f"{base_lat},{base_lon}"},
        {"name": "ring", "coords": f"{base_lat - 0.02},{base_lon - 0.03}"},
        {"name": "downtown", "coords": f"{base_lat + 0.007},{base_lon + 0.017}"}
    ]
    
    speeds = []
    congestions = {}
    
    for point in points:
        try:
            url = f"https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point={point['coords']}&key={tomtom_key}"
            res = requests.get(url, timeout=10)
            res.raise_for_status()
            data = res.json()
            
            flow = data.get("flowSegmentData", {})
            current_speed = float(flow.get("currentSpeed", 0.0))
            free_flow_speed = float(flow.get("freeFlowSpeed", 0.0))
            
            if free_flow_speed > 0:
                speeds.append(current_speed)
                congestion = round((1 - current_speed / free_flow_speed) * 100)
                congestions[point["name"]] = congestion
        except Exception as e:
            continue
            
    if not congestions:
        if traffic_cache[cache_key]["data"]:
            return jsonify(traffic_cache[cache_key]["data"])
        return jsonify({"error": "Traffic service unavailable"}), 503
        
    avg_speed = round(sum(speeds) / len(speeds), 1)
    highway_cong = congestions.get("highway", 0)
    ring_cong = congestions.get("ring", 0)
    downtown_cong = congestions.get("downtown", 0)
    overall_congestion = round(sum(congestions.values()) / len(congestions))
    
    result = {
        "avg_speed": avg_speed,
        "highway_congestion": highway_cong,
        "ring_congestion": ring_cong,
        "downtown_congestion": downtown_cong,
        "overall_congestion": overall_congestion,
        "incidents": 0
    }
    
    traffic_cache[cache_key]["data"] = result
    traffic_cache[cache_key]["timestamp"] = current_time
    
    return jsonify(result)

@app.route('/api/waste', methods=['GET'])
def get_waste():
    try:
        with open('waste_data.json', 'r') as f:
            data = json.load(f)
            
        city = request.args.get('city', 'Jaipur')
        # pseudo randomize based on city name string hash so different cities have different waste
        city_hash = sum([ord(c) for c in city])
        
        offset_a = (city_hash % 20) - 10
        offset_b = ((city_hash * 2) % 30) - 15
        offset_c = ((city_hash * 3) % 20) - 10
        
        return jsonify({
            "zone_a": max(0, min(100, data["zone_a"] + offset_a)),
            "zone_b": max(0, min(100, data["zone_b"] + offset_b)),
            "zone_c": max(0, min(100, data["zone_c"] + offset_c)),
            "bins_full": max(0, data["bins_full"] + (city_hash % 10 - 5)),
            "last_updated": data["last_updated"]
        })
    except Exception as e:
        return jsonify({"error": "Service unavailable"}), 503

@app.route('/api/waste/update', methods=['POST'])
def update_waste():
    try:
        req_data = request.get_json()
        zone = req_data.get('zone')
        fill_pct = req_data.get('fill_pct')
        
        if zone not in ['a', 'b', 'c'] or fill_pct is None:
            return jsonify({"error": "Invalid request"}), 400
            
        with open('waste_data.json', 'r') as f:
            data = json.load(f)
            
        data[f'zone_{zone}'] = int(fill_pct)
        data['last_updated'] = datetime.now().isoformat()
        
        with open('waste_data.json', 'w') as f:
            json.dump(data, f, indent=2)
            
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": "Service unavailable"}), 503

if __name__ == '__main__':
    app.run(debug=True, port=5000)
