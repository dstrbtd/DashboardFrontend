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

export default function InvestorGraphPeers() {
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

        const firstValidator = data.validators[validatorUIDs[0]];
        const epochs = firstValidator.peers.epoch;
        const peerCounts = firstValidator.peers.count;

        const formattedData = {
          labels: epochs,
          datasets: [
            {
              label: 'Number of Peers',
              data: peerCounts,
              borderColor: '#000000',
              backgroundColor: 'transparent',
              tension: 0.4,
              pointRadius: 3,
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
      } catch (err) {
        console.error('Error parsing WebSocket message in InvestorGraphPeers:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error in InvestorGraphPeers:', err);
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
    plugins: {
      title: {
        display: false,
        text: runId
          ? `Run ${runId} - Active Peers Over Outer Steps`
          : 'Active Peers Over Outer Steps',
        color: '#e0e0e0',
        font: {
          size: 16,
          family: "'IBM Plex Mono', monospace",
        },
      },
      legend: {
        display: false,
        labels: {
          color: '#e0e0e0',
        },
      },
      tooltip: {
        backgroundColor: '#333',
        titleFont: {
          family: "'IBM Plex Mono', monospace",
          size: 14,
        },
        bodyFont: {
          family: "'IBM Plex Mono', monospace",
          size: 12,
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Outer Step', color: '#e0e0e0' },
        ticks: { color: '#e0e0e0' },
        grid: { color: 'rgba(224,224,224,0.1)' },
      },
      y: {
        title: { display: true, text: 'Peers', color: '#e0e0e0' },
        ticks: { color: '#e0e0e0' },
        grid: { color: 'rgba(224,224,224,0.1)' },
      },
    },
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {chartData ? (
        <Line
          ref={(el) => {
            if (el) chartRef.current = el.chartInstance ?? el;
          }}
          data={chartData}
          options={options}
        />
      ) : (
        <p>Loading peer chart...</p>
      )}
    </div>
  );
}
