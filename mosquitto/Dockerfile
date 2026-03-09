# Custom Mosquitto with embedded config
FROM eclipse-mosquitto:2

# Copy custom config
COPY mosquitto.conf /mosquitto/config/mosquitto.conf

# Expose MQTT and WebSocket ports
EXPOSE 1883 9001

CMD ["mosquitto", "-c", "/mosquitto/config/mosquitto.conf"]
