import React, { useEffect, useState, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import websocketConfig from '../config/websocketUrls';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function InvestorGraphLR() {
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

        const validatorUIDs = Object.keys(data.validators || {});
        if (validatorUIDs.length === 0) return;

        // Pick validator with most epochs for learning rate
        let selectedValidator = data.validators[validatorUIDs[0]];
        for (const uid of validatorUIDs) {
          if (
            (data.validators[uid]?.learning_rate?.epoch?.length || 0) >
            (selectedValidator?.learning_rate?.epoch?.length || 0)
          ) {
            selectedValidator = data.validators[uid];
          }
        }

        if (
          !selectedValidator?.learning_rate?.epoch ||
          !selectedValidator?.learning_rate?.value
        )
          return;

        const epochs = selectedValidator.learning_rate.epoch;

        // Map non-number (null or others) to null for Chart.js compatibility
        const lrValues = selectedValidator.learning_rate.value.map((v) =>
          typeof v === 'number' ? v : null
        );

        const formattedData = {
          labels: epochs,
          datasets: [
            {
              label: 'Learning Rate',
              data: lrValues,
              borderColor: '#f59e0b',
              backgroundColor: 'transparent',
              tension: 0.4,
              pointRadius: 0,
              hoverRadius: 6,
              borderWidth: 2,
              yAxisID: 'y',
            },
          ],
        };

        setChartData(formattedData);

        setTimeout(() => {
          if (chartRef.current) {
            chartRef.current.resize();
          }
        }, 300);
      } catch {
        // silently ignore parse errors
      }
    };

    ws.onerror = () => {
      // silently ignore errors
    };

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current) {
        chartRef.current.resize();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: false,
        text: runId
          ? `Run ${runId} - Learning Rate Over Outer Steps`
          : 'Learning Rate Over Outer Steps',
        color: '#eee',
        font: { size: 16, family: "'Inter', sans-serif" },
      },
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(20, 20, 20, 0.95)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
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
          label: (context) => {
            const value = context.parsed.y;
            return value !== null
              ? `Learning Rate: ${value.toExponential(5)}`
              : 'Learning Rate: N/A';
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
    interaction: { mode: 'nearest', intersect: false },
    scales: {
      x: {
        title: { 
          display: true, 
          text: 'Outer Step', 
          color: 'rgba(255, 255, 255, 0.7)',
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
          color: 'rgba(255, 255, 255, 0.05)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderDash: [2, 2],
          drawBorder: true,
        },
      },
      y: {
        title: { 
          display: false, 
          text: 'Learning Rate', 
          color: 'rgba(255, 255, 255, 0.7)',
        },
        ticks: { 
          color: 'rgba(255, 255, 255, 0.5)',
          font: {
            family: "'Inter', sans-serif",
            size: 11,
          },
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderDash: [2, 2],
          drawBorder: true,
        },
      },
    },
    elements: {
      line: { 
        borderColor: '#f59e0b', 
        borderWidth: 2, 
        tension: 0.4,
        fill: false,
      },
      point: {
        radius: 0,
        hoverRadius: 6,
        hoverBorderWidth: 2,
        backgroundColor: '#f59e0b',
        hoverBackgroundColor: '#fbbf24',
        borderColor: '#fff',
      },
    },
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h3
        className="text-ibm"
        style={{
          color: '#ffffff',
          marginBottom: 12,
          textAlign: 'left',
          fontSize: '1.1rem',
          fontWeight: '600',
        }}
      >
        Learning Rate
      </h3>
      <div style={{ flexGrow: 1 }}>
        {chartData ? (
          <Line
            key={JSON.stringify(chartData)}
            ref={chartRef}
            data={chartData}
            options={options}
          />
        ) : (
          <p style={{ color: '#eee' }}>Loading learning rate chart...</p>
        )}
      </div>
    </div>
  );
}
