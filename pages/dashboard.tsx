import React from 'react';
import Head from 'next/head';
import { Dashboard } from '../src/components/Dashboard/Dashboard';

export default function DashboardPage() {
  return (
    <>
      <Head>
        <title>슬랙 채널 모니터링 대시보드</title>
        <meta name="description" content="실시간 슬랙 채널 상태 모니터링" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Dashboard />
    </>
  );
}