package mqtt

import (
	"fmt"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"sight/internal/logger"
)

type Client struct {
	client mqtt.Client
	log    *logger.Logger
}

func NewClient(brokerURI string, clientID string, log *logger.Logger) (*Client, error) {
	opts := mqtt.NewClientOptions()
	opts.AddBroker(brokerURI)
	opts.SetClientID(clientID)

	opts.OnConnect = func(c mqtt.Client) {
		log.Info("MQTT connected", "broker", brokerURI)
	}

	opts.OnConnectionLost = func(c mqtt.Client, err error) {
		log.Error("MQTT connection lost", "error", err)
	}

	client := mqtt.NewClient(opts)
	if token := client.Connect(); token.Wait() && token.Error() != nil {
		return nil, fmt.Errorf("failed to connect to mqtt broker: %w", token.Error())
	}

	return &Client{
		client: client,
		log:    log,
	}, nil
}

func (c *Client) Disconnect() {
	c.log.Info("Disconnecting from MQTT broker")
	c.client.Disconnect(250)
}
