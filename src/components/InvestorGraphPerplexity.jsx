import React, { useEffect, useState, useRef } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import websocketConfig from "../config/websocketUrls";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function InvestorGraphPerplexity() {
  const chartRef = useRef(null);
  const wsRef = useRef(null);
  const [chartData, setChartData] = useState(null);
  const [runId, setRunId] = useState(null);

  useEffect(() => {
    const ws = new WebSocket(websocketConfig.WS_URL);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setRunId(data.run_id || null);

        const lossGraph = data.loss_graph || {};
        const outerSteps = lossGraph.outer_steps || [];
        const losses = lossGraph.losses || [];

        if (outerSteps.length === 0 || losses.length === 0) return;

        // Convert loss values to perplexity
        const perplexities = losses.map((loss) => Math.exp(loss));

        const formattedData = {
          labels: outerSteps,
          datasets: [
            {
              label: "Perplexity",
              data: perplexities,
              borderColor: "rgb(255, 159, 64)",
              backgroundColor: "transparent",
              tension: 0.4,
              pointRadius: 3,
            },
          ],
        };

        setChartData(formattedData);

        setTimeout(() => {
          if (chartRef.current) {
            chartRef.current.resize();
          }
        }, 300);
      } catch (err) {
        console.error(
          "Error parsing WebSocket message in InvestorGraphPerplexity:",
          err
        );
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error in InvestorGraphPerplexity:", err);
    };

    return () => {
      ws.close();
    };
  }, []);

  const options = {
    responsive: true,
    plugins: {
      title: {
        display: false,
        text: runId
          ? `Run ${runId} - Global Model Perplexity Over Outer Steps`
          : "Global Model Perplexity Over Outer Steps",
        color: "#e0e0e0",
        font: {
          size: 16,
          family: "'IBM Plex Mono', monospace",
        },
      },
      legend: {
        display: false,
        labels: {
          color: "#e0e0e0",
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: "Outer Step", color: "#e0e0e0" },
        ticks: { color: "#e0e0e0" },
        grid: { color: "rgba(224,224,224,0.1)" },
      },
      y: {
        title: { display: true, text: "Perplexity", color: "#e0e0e0" },
        ticks: { color: "#e0e0e0" },
        grid: { color: "rgba(224,224,224,0.1)" },
      },
    },
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {chartData ? (
        <Line ref={chartRef} data={chartData} options={options} />
      ) : (
        <p>Loading perplexity chart...</p>
      )}
    </div>
  );
}
