import React from 'react';
import { Plug } from 'lucide-react';
import { ZigIntegration } from '../sales/ZigIntegration';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface IntegrationsPageProps {
  onSyncComplete?: () => void;
}

export function IntegrationsPage({ onSyncComplete }: IntegrationsPageProps) {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Plug className="w-7 h-7 text-blue-600" aria-hidden />
          Integrações
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Conecte sistemas externos ao estoque e às vendas. Novas integrações podem ser adicionadas aqui.
        </p>
      </div>

      <section aria-labelledby="zig-heading" className="space-y-3">
        <h2 id="zig-heading" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          ZIG
        </h2>
        <ZigIntegration onSyncComplete={onSyncComplete} />
      </section>

      <section aria-labelledby="more-heading">
        <h2 id="more-heading" className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Outras integrações
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>Em breve</CardTitle>
            <CardDescription>
              Espaço reservado para novos conectores (APIs, ERPs, marketplaces, etc.).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Quando você adicionar uma nova integração, ela aparecerá nesta área.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
