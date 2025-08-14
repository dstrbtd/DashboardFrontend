import React from 'react';
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

// Register necessary Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const data = {
  labels: [101, 102, 103, 104],
  datasets: [
    {
      label: 'Validator Score',
      data: [0.85, 0.90, 0.87, 0.91],
      borderColor: '#3b82f6', // Tailwind blue-500
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      fill: true,
      tension: 0.3,
      pointRadius: 5,
      pointHoverRadius: 7,
    },
  ],
};

const options = {
  responsive: true,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        color: '#e0e0e0',
        font: {
          family: "'IBM Plex Mono', monospace",
          size: 14,
          weight: 'bold',
        },
      },
    },
    title: {
      display: true,
      text: 'Miner Graph 2 - Validator Scores Over Epochs',
      color: '#e0e0e0',
      font: {
        family: "'IBM Plex Mono', monospace",
        size: 18,
        weight: 'bold',
      },
    },
    tooltip: {
      enabled: true,
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
      title: {
        display: true,
        text: 'Epoch',
        color: '#e0e0e0',
        font: {
          family: "'IBM Plex Mono', monospace",
          size: 14,
        },
      },
      ticks: {
        color: '#e0e0e0',
      },
      grid: {
        color: 'rgba(224, 224, 224, 0.1)',
      },
    },
    y: {
      title: {
        display: true,
        text: 'Score',
        color: '#e0e0e0',
        font: {
          family: "'IBM Plex Mono', monospace",
          size: 14,
        },
      },
      ticks: {
        color: '#e0e0e0',
        beginAtZero: true,
        max: 1,
      },
      grid: {
        color: 'rgba(224, 224, 224, 0.1)',
      },
    },
  },
};

export default function MinerGraph2() {
  return (
    <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <Line data={data} options={options} />
    </div>
  );
}
