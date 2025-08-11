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

        // Pick validator with most epochs
        let selectedValidator = data.validators[validatorUIDs[0]];
        for (const uid of validatorUIDs) {
          if ((data.validators[uid]?.peers?.epoch?.length || 0) >
              (selectedValidator?.peers?.epoch?.length || 0)) {
            selectedValidator = data.validators[uid];
          }
        }

        if (!selectedValidator?.peers?.epoch || !selectedValidator?.peers?.count) return;

        const epochs = selectedValidator.peers.epoch;
        const peerCounts = selectedValidator.peers.count;

        const formattedData = {
          labels: epochs,
          datasets: [
            {
              label: 'Number of Peers',
              data: peerCounts,
              borderColor: '#ff4c4c',
              backgroundColor: 'rgba(255, 76, 76, 0.3)',
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
      } catch {
        // silently ignore parse errors
      }
    };

    ws.onerror = () => {
      // silently ignore errors here
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
        labels: { color: '#e0e0e0' },
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
          key={JSON.stringify(chartData)}
          ref={chartRef}
          data={chartData}
          options={options}
        />
      ) : (
        <p>Loading peer chart...</p>
      )}
    </div>
  );
}
