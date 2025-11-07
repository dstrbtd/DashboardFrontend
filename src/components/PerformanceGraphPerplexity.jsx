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

        const lossGraph = data.global_loss_data || {};
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
              borderColor: "#eee",
              backgroundColor: "transparent",
              tension: 0.4,
              pointRadius: 0,
              hoverRadius: 5,
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
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: false,
        text: runId
          ? `Run ${runId} - Global Model Perplexity Over Outer Steps`
          : "Global Model Perplexity Over Outer Steps",
        color: "#eee",
        font: {
          size: 16,
          family: "'IBM Plex Mono', monospace",
        },
      },
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: "#111",
        titleColor: "#eee",
        bodyColor: "#eee",
        cornerRadius: 0,
        caretSize: 5,
        displayColors: false,
        callbacks: {
          label: function (context) {
            const value = context.parsed.y;
            return `Perplexity: ${value.toFixed(1)}`;
          },
        },
      },
    },
    layout: {
      padding: 10,
    },
    interaction: {
      mode: "nearest",
      intersect: false,
    },
    scales: {
      x: {
        title: { display: true, text: "Outer Step", color: "#eee" },
        ticks: { color: '#eee', autoSkip: true, maxTicksLimit: 14 },
        grid: {
          color: "transparent",
          borderColor: "transparent",
        },
      },
      y: {
        title: { display: false, text: "Perplexity", color: "#eee" },
        ticks: { color: "#eee" },
        grid: {
          color: "transparent",
          borderColor: "transparent",
        },
      },
    },
    elements: {
      line: {
        borderColor: "#eee",
        borderWidth: 1.5,
        tension: 0.4,
      },
      point: {
        radius: 0,
        hoverRadius: 5,
        backgroundColor: "#eee",
        hoverBackgroundColor: "#eee",
      },
    },
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <h3
        className="text-ibm"
        style={{
          color: "#eee",
          marginBottom: 8,
          textAlign: "left",
          flexShrink: 0,
        }}
      >
        Perplexity
      </h3>
      <div style={{ flexGrow: 1 }}>
        {chartData ? (
          <Line ref={chartRef} data={chartData} options={options} />
        ) : (
          <p style={{ color: "#eee" }}>Loading perplexity chart...</p>
        )}
      </div>
    </div>
  );
}
