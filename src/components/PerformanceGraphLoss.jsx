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

export default function InvestorGraphLoss() {
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

        const formattedData = {
          labels: outerSteps,
          datasets: [
            {
              label: "Loss",
              data: losses,
              borderColor: "#34d399",
              backgroundColor: "transparent",
              tension: 0.4,
              pointRadius: 0,
              hoverRadius: 6,
              borderWidth: 2,
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
        console.error("Error parsing WebSocket message in InvestorGraphLoss:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error in InvestorGraphLoss:", err);
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
          ? `Run ${runId} - Global Model Loss Over Outer Steps`
          : "Global Model Loss Over Outer Steps",
        color: "#eee",
        font: {
          size: 16,
          family: "'Inter', sans-serif",
        },
      },
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: "rgba(20, 20, 20, 0.95)",
        titleColor: "#fff",
        bodyColor: "#fff",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        caretSize: 6,
        displayColors: false,
        titleFont: {
          family: "'Inter', sans-serif",
          size: 12,
          weight: '600',
        },
        bodyFont: {
          family: "'Inter', sans-serif",
          size: 13,
        },
        callbacks: {
          label: function (context) {
            const value = context.parsed.y;
            return `Loss: ${value.toFixed(4)}`;
          },
        },
      },
    },
    layout: {
      padding: {
        top: 8,
        bottom: 8,
        left: 8,
        right: 8,
      },
    },
    interaction: {
      mode: "nearest",
      intersect: false,
    },
    scales: {
      x: {
        title: { 
          display: true, 
          text: "Outer Step", 
          color: "rgba(255, 255, 255, 0.7)",
          font: {
            family: "'Inter', sans-serif",
            size: 12,
            weight: '500',
          },
          padding: { top: 8, bottom: 0 },
        },
        ticks: { 
          color: 'rgba(255, 255, 255, 0.5)', 
          autoSkip: true, 
          maxTicksLimit: 12,
          font: {
            family: "'Inter', sans-serif",
            size: 11,
          },
        },
        grid: {
          color: "rgba(255, 255, 255, 0.05)",
          borderColor: "rgba(255, 255, 255, 0.1)",
          borderDash: [2, 2],
          drawBorder: true,
        },
      },
      y: {
        title: { 
          display: false, 
          text: "Loss", 
          color: "rgba(255, 255, 255, 0.7)",
        },
        ticks: { 
          color: "rgba(255, 255, 255, 0.5)",
          font: {
            family: "'Inter', sans-serif",
            size: 11,
          },
        },
        grid: {
          color: "rgba(255, 255, 255, 0.05)",
          borderColor: "rgba(255, 255, 255, 0.1)",
          borderDash: [2, 2],
          drawBorder: true,
        },
      },
    },
    elements: {
      line: {
        borderColor: "#34d399",
        borderWidth: 2,
        tension: 0.4,
        fill: false,
      },
      point: {
        radius: 0,
        hoverRadius: 6,
        hoverBorderWidth: 2,
        backgroundColor: "#34d399",
        hoverBackgroundColor: "#6ee7b7",
        borderColor: "#fff",
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
          color: "#ffffff",
          marginBottom: 12,
          textAlign: "left",
          flexShrink: 0,
          fontSize: "1.1rem",
          fontWeight: "600",
        }}
      >
        Loss
      </h3>
      <div style={{ flexGrow: 1 }}>
        {chartData ? (
          <Line ref={chartRef} data={chartData} options={options} />
        ) : (
          <p style={{ color: "#eee" }}>Loading loss chart...</p>
        )}
      </div>
    </div>
  );
}
