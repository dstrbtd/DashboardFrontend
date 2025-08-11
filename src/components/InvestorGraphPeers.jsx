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
  const [refreshKey, setRefreshKey] = useState(0);

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
          if (
            (data.validators[uid]?.peers?.epoch?.length || 0) >
            (selectedValidator?.peers?.epoch?.length || 0)
          ) {
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
              borderColor: '#eee',
              backgroundColor: 'transparent',
              tension: 0.4,
              pointRadius: 0,
              hoverRadius: 5,
              yAxisID: 'y',
            },
          ],
        };

        setChartData(formattedData);
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

  // Force remount on new chartData to ensure full chart redraw
  useEffect(() => {
    if (chartData) {
      setRefreshKey(k => k + 1);
    }
  }, [chartData]);

  // Resize and update chart on refreshKey change (new data)
  useEffect(() => {
    if (chartRef.current) {
      try {
        chartRef.current.resize();
        chartRef.current.update();
      } catch (e) {
        // ignore errors if chart not yet ready
      }
    }
  }, [refreshKey]);

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
          ? `Run ${runId} - Active Peers Over Outer Steps`
          : 'Active Peers Over Outer Steps',
        color: '#eee',
        font: {
          size: 16,
          family: "'IBM Plex Mono', monospace",
        },
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
          label: function (context) {
            const value = context.parsed.y;
            return `Peers: ${value}`;
          },
        },
      },
    },
    layout: {
      padding: 10,
    },
    interaction: {
      mode: 'nearest',
      intersect: false,
    },
    scales: {
      x: {
        title: { display: true, text: 'Outer Step', color: '#eee' },
        ticks: { color: '#eee' },
        grid: {
          color: 'transparent',
          borderColor: 'transparent',
        },
      },
      y: {
        title: { display: false, text: 'Peers', color: '#eee' },
        ticks: { color: '#eee' },
        grid: {
          color: 'transparent',
          borderColor: 'transparent',
        },
      },
    },
    elements: {
      line: {
        borderColor: '#eee',
        borderWidth: 1.5,
        tension: 0.4,
      },
      point: {
        radius: 0,
        hoverRadius: 5,
        backgroundColor: '#eee',
        hoverBackgroundColor: '#eee',
      },
    },
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <h3
        className="text-ibm"
        style={{
          color: '#eee',
          marginBottom: 8,
          textAlign: 'left',
          flexShrink: 0,
        }}
      >
        Number of Peers
      </h3>
      <div style={{ flexGrow: 1 }}>
        {chartData ? (
          <Line
            key={refreshKey}
            ref={chartRef}
            data={chartData}
            options={options}
          />
        ) : (
          <p style={{ color: '#eee' }}>Loading peer chart...</p>
        )}
      </div>
    </div>
  );
}
