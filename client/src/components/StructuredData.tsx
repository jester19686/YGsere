'use client';

import Script from 'next/script';

export default function StructuredData() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Бункер Онлайн',
    alternateName: 'Bunker Online',
    url: 'https://bunker-zone.ru',
    description: 'Браузерная онлайн-игра Бункер. 366 уникальных карт, 17 катаклизмов, от 4 до 16 игроков. Убеди других в своей ценности и попади в бункер!',
    applicationCategory: 'Game',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'RUB',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '1250',
      bestRating: '5',
      worstRating: '1',
    },
    author: {
      '@type': 'Organization',
      name: 'Bunker Online Team',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Bunker Online',
      url: 'https://bunker-zone.ru',
    },
    inLanguage: 'ru-RU',
    isAccessibleForFree: true,
    gameItem: {
      '@type': 'Thing',
      name: 'Карты персонажей',
    },
    numberOfPlayers: {
      '@type': 'QuantitativeValue',
      minValue: 4,
      maxValue: 16,
    },
    playMode: 'MultiPlayer',
  };

  const organizationData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Bunker Online',
    url: 'https://bunker-zone.ru',
    logo: 'https://bunker-zone.ru/logo.png',
    sameAs: [],
  };

  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Главная',
        item: 'https://bunker-zone.ru',
      },
    ],
  };

  return (
    <>
      <Script
        id="structured-data-webapp"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Script
        id="structured-data-organization"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationData) }}
      />
      <Script
        id="structured-data-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
    </>
  );
}
