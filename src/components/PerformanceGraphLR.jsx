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
              borderColor: '#f6f6f7',
              backgroundColor: 'transparent',
              tension: 0.4,
              pointRadius: 0,
              hoverRadius: 5,
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
        font: { size: 16, family: "'IBM Plex Mono', monospace" },
      },
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: '#111',
        titleColor: '#eee',
        bodyColor: '#eee',
        cornerRadius: 0,
        caretSize: 5,
        displayColors: false,
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
    layout: { padding: 10 },
    interaction: { mode: 'nearest', intersect: false },
    scales: {
      x: {
        title: { display: true, text: 'Outer Step', color: '#eee' },
        ticks: { color: '#eee' },
        grid: { color: 'transparent', borderColor: 'transparent' },
      },
      y: {
        title: { display: false, text: 'Learning Rate', color: '#eee' },
        ticks: { color: '#eee' },
        grid: { color: 'transparent', borderColor: 'transparent' },
      },
    },
    elements: {
      line: { borderColor: '#eee', borderWidth: 1.5, tension: 0.4 },
      point: {
        radius: 0,
        hoverRadius: 5,
        backgroundColor: '#eee',
        hoverBackgroundColor: '#eee',
      },
    },
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h3
        className="text-ibm"
        style={{ color: '#eee', marginBottom: 8, textAlign: 'left' }}
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
