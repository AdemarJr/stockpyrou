import React from 'react';
import { 
  CheckCircle2, 
  BarChart3, 
  Smartphone, 
  Barcode, 
  Zap, 
  ShieldCheck, 
  ArrowRight, 
  MessageCircle,
  Menu,
  X,
  Package,
  TrendingUp,
  Truck,
  Moon,
  Sun,
  Command,
  Search,
  Users,
  Database,
  LockKeyhole,
  Sparkles,
  Star,
  Layers,
  Wifi,
  WifiOff,
  Receipt,
  CreditCard,
  Camera,
  FileText,
  Clock,
  TrendingDown
} from 'lucide-react';
import { motion } from 'motion/react';
import image_e6773d54ec7685ec36adaaee57705c2d461a8da0 from 'figma:asset/e6773d54ec7685ec36adaaee57705c2d461a8da0.png';
import logoImg from "figma:asset/e8d336438522d7b8e8099c7d47e7869928dfd8f9.png";
import dashboardAppImg from "figma:asset/0a1edac33c22f30efd413c7ef8bd73eb4788f257.png";
import { ImageWithFallback } from '../figma/ImageWithFallback';

interface LandingPageProps {
  onLoginClick: () => void;
  onAdminClick?: () => void;
}

export function LandingPage({ onLoginClick, onAdminClick }: LandingPageProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const features = [
    {
      title: "Dark Mode Profissional",
      description: "Interface moderna com tema escuro/claro. Reduz fadiga visual e melhora a produtividade em ambientes de trabalho.",
      icon: <Moon className="w-6 h-6 text-blue-600" />,
      image: "https://images.unsplash.com/photo-1762340276397-db7ca4ee6ab6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwbW9kZSUyMGludGVyZmFjZXxlbnwxfHx8fDE3NjkyOTQzMjR8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      badge: "NEW"
    },
    {
      title: "Busca Instantânea (⌘K)",
      description: "Encontre produtos por nome, SKU ou código de barras em milissegundos. Atalho Cmd/Ctrl+K para acesso rápido.",
      icon: <Command className="w-6 h-6 text-blue-600" />,
      image: "https://images.unsplash.com/photo-1763107228544-2ad5d71c21f0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2JpbGUlMjBhcHAlMjBwcm9kdWN0aXZpdHl8ZW58MXx8fHwxNjkyOTgyMzF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      badge: "NEW"
    },
    {
      title: "Módulo de Caixa/PDV Completo",
      description: "Sistema completo de Ponto de Venda com abertura/fechamento de caixa, vendas rápidas, sangrias, reforços e integração WhatsApp para envio de recibos.",
      icon: <Receipt className="w-6 h-6 text-blue-600" />,
      image: "https://images.unsplash.com/photo-1556742521-9713bf272865?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZXRhaWwlMjBwb3MlMjBzeXN0ZW18ZW58MXx8fHwxNzY5MjAyMzAxfDA&ixlib=rb-4.1.0&q=80&w=1080",
      badge: "HOT"
    },
    {
      title: "Funcionamento Offline-First",
      description: "Continue vendendo mesmo sem internet! Sistema com cache inteligente que sincroniza automaticamente quando a conexão volta.",
      icon: <WifiOff className="w-6 h-6 text-blue-600" />,
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvZmZsaW5lJTIwdGVjaG5vbG9neSUyMG1vYmlsZXxlbnwxfHx8fDE3NjkyMDIzMDF8MA&ixlib=rb-4.1.0&q=80&w=1080",
      badge: "HOT"
    },
    {
      title: "Relatórios Inteligentes",
      description: "Análises detalhadas de vendas, fechamentos de caixa, desperdícios, lucratividade e previsão de demanda. Exporte em Excel e PDF.",
      icon: <FileText className="w-6 h-6 text-blue-600" />,
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXNoYm9hcmQlMjBhbmFseXRpY3MlMjByZXBvcnRzfGVufDF8fHx8MTc2OTIwMjMwMXww&ixlib=rb-4.1.0&q=80&w=1080",
      badge: null
    },
    {
      title: "Scanner de Câmera Nativo",
      description: "Use a câmera do celular ou webcam para escanear códigos de barras. Perfeito para inventário, vendas e entrada de produtos.",
      icon: <Camera className="w-6 h-6 text-blue-600" />,
      image: "https://images.unsplash.com/photo-1758543102397-e14b5dfdd8bd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYXJjb2RlJTIwc2Nhbm5lciUyMHJldGFpbCUyMHRlY2hub2xvZ3l8ZW58MXx8fHwxNzY5MjAyMzAxfDA&ixlib=rb-4.1.0&q=80&w=1080",
      badge: null
    },
    {
      title: "Multi-Tenant Seguro",
      description: "Isolamento total entre empresas. Cada organização possui seus próprios dados, usuários e configurações com criptografia de ponta.",
      icon: <Database className="w-6 h-6 text-blue-600" />,
      image: "https://images.unsplash.com/photo-1748609339084-ea43ec1b8fbb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBidXNpbmVzcyUyMGRhc2hib2FyZHxlbnwxfHx8fDE3NjkyNDAxNTV8MA&ixlib=rb-4.1.0&q=80&w=1080",
      badge: null
    },
    {
      title: "PWA com Auto-Update",
      description: "Progressive Web App que funciona como aplicativo nativo. Atualizações automáticas sem necessidade de download manual.",
      icon: <Smartphone className="w-6 h-6 text-blue-600" />,
      image: "https://images.unsplash.com/photo-1645226880663-81561dcab0ae?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2JpbGUlMjBhcHAlMjBzbWFydHBob25lJTIwYnVzaW5lc3N8ZW58MXx8fHwxNzY5MjAyMzAxfDA&ixlib=rb-4.1.0&q=80&w=1080",
      badge: null
    },
    {
      title: "Gestão de Múltiplos Pagamentos",
      description: "Aceite dinheiro, PIX, cartão de crédito e débito. Controle total de sangrias, reforços e fechamento de caixa com conferência automática.",
      icon: <CreditCard className="w-6 h-6 text-blue-600" />,
      image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYXltZW50JTIwbWV0aG9kcyUyMGNhc2hpZXJ8ZW58MXx8fHwxNzY5MjAyMzAxfDA&ixlib=rb-4.1.0&q=80&w=1080",
      badge: null
    },
    {
      title: "Integração API ZIG",
      description: "Conecte com a API da ZIG para automação de processos financeiros, gestão de pagamentos e conciliação bancária.",
      icon: <Zap className="w-6 h-6 text-blue-600" />,
      image: "https://images.unsplash.com/photo-1740914994657-f1cdffdc418e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3YXJlaG91c2UlMjBtYW5hZ2VtZW50JTIwaW52ZW50b3J5fGVufDF8fHx8MTc2OTE2NjY2OXww&ixlib=rb-4.1.0&q=80&w=1080",
      badge: null
    },
    {
      title: "Histórico Completo de Operações",
      description: "Rastreie todas as movimentações, vendas, fechamentos e ajustes. Auditoria completa com usuário, data/hora e motivo de cada ação.",
      icon: <Clock className="w-6 h-6 text-blue-600" />,
      image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoaXN0b3J5JTIwdGltZWxpbmUlMjBhdWRpdHxlbnwxfHx8fDE3NjkyMDIzMDF8MA&ixlib=rb-4.1.0&q=80&w=1080",
      badge: null
    }
  ];

  const differentials = [
    {
      icon: <Receipt className="w-6 h-6" />,
      title: "PDV Completo",
      description: "Caixa com vendas, sangrias e WhatsApp"
    },
    {
      icon: <WifiOff className="w-6 h-6" />,
      title: "Funciona Offline",
      description: "Venda mesmo sem internet"
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: "Relatórios Avançados",
      description: "Análises de vendas e fechamentos"
    },
    {
      icon: <Camera className="w-6 h-6" />,
      title: "Scanner Nativo",
      description: "Câmera para código de barras"
    },
    {
      icon: <LockKeyhole className="w-6 h-6" />,
      title: "Segurança Total",
      description: "Multi-tenant com isolamento"
    },
    {
      icon: <Smartphone className="w-6 h-6" />,
      title: "PWA Auto-Update",
      description: "Atualizações automáticas"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Multi-Usuário",
      description: "Controle de permissões"
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: "Interface Moderna",
      description: "Dark mode e busca ⌘K"
    }
  ];

  const testimonials = [
    {
      name: "Carlos Silva",
      role: "Dono de Restaurante",
      company: "Sabor & Arte",
      content: "O módulo de Caixa/PDV revolucionou nosso atendimento. Agora fazemos vendas rápidas mesmo com a internet oscilando. O modo offline é fantástico!",
      rating: 5
    },
    {
      name: "Ana Paula",
      role: "Gerente de Loja",
      company: "Moda Express",
      content: "Incrível ter tudo no celular! O scanner de câmera acelerou nosso inventário em 80%. E os relatórios de vendas nos ajudam a tomar decisões estratégicas.",
      rating: 5
    },
    {
      name: "Roberto Lima",
      role: "Diretor de Operações",
      company: "DistribuMax",
      content: "O sistema multi-tenant é perfeito para nossa rede. Cada filial tem seu painel administrativo e conseguimos acompanhar fechamentos de caixa em tempo real.",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-2">
              <img src={logoImg} alt="PyrouStock Logo" className="w-10 h-10 rounded-xl" />
              <span className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                PyrouStock
              </span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Funcionalidades</a>
              <a href="#benefits" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Benefícios</a>
              <button 
                onClick={onLoginClick}
                className="text-sm font-bold text-gray-700 hover:text-blue-600 transition-colors"
              >
                Acessar Painel
              </button>
              <a 
                href="https://wa.me/5592994764780?text=Olá! Gostaria de conhecer o PyrouStock" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-blue-600 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
              >
                Falar com Consultor
              </a>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-gray-600">
                {isMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-white border-b border-gray-100 p-4 space-y-4 shadow-xl"
          >
            <a href="#features" onClick={() => setIsMenuOpen(false)} className="block text-lg font-medium text-gray-600">Funcionalidades</a>
            <a href="#benefits" onClick={() => setIsMenuOpen(false)} className="block text-lg font-medium text-gray-600">Benefícios</a>
            <hr className="border-gray-100" />
            <button 
              onClick={() => { onLoginClick(); setIsMenuOpen(false); }}
              className="w-full text-center py-3 font-bold text-gray-700"
            >
              Acessar Painel
            </button>
            <a 
              href="https://wa.me/5592994764780?text=Olá! Gostaria de conhecer o PyrouStock"
              className="block w-full text-center bg-blue-600 text-white py-4 rounded-xl font-bold"
            >
              Falar com Consultor
            </a>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 lg:pt-48 lg:pb-32 px-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 -z-10 w-1/3 h-full bg-gradient-to-br from-blue-50 to-indigo-50 rounded-l-[100px] hidden lg:block"></div>
        <div className="absolute -top-40 -right-40 -z-10 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 -z-10 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 space-y-8 text-center lg:text-left">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 rounded-full text-sm font-bold border border-blue-100"
            >
              <Sparkles className="w-4 h-4" />
              Gestão inteligente para o seu negócio
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-6xl lg:text-7xl font-black text-gray-900 leading-[1.1]"
            >
              O controle do seu estoque na <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">palma da mão.</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed"
            >
              Simplifique sua operação com o PyrouStock. Um SaaS multi-tenant completo com <strong className="text-gray-900">Dark Mode</strong>, <strong className="text-gray-900">busca instantânea (⌘K)</strong> e gestão de estoque e PDV inteligente.
            </motion.p>
            
            {/* Feature Pills */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="flex flex-wrap gap-3 justify-center lg:justify-start"
            >
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-bold">
                <Command className="w-4 h-4" />
                Busca Rápida ⌘K
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-bold">
                <Moon className="w-4 h-4" />
                Dark Mode
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-full text-sm font-bold">
                <Database className="w-4 h-4" />
                Multi-Tenant
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4"
            >
              <a 
                href="https://wa.me/5592994764780?text=Olá! Gostaria de falar com um consultor PyrouStock"
                className="w-full sm:w-auto px-10 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-2xl shadow-blue-200 flex items-center justify-center gap-2 group"
              >
                Começar Agora
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
              <button 
                onClick={onLoginClick}
                className="w-full sm:w-auto px-10 py-5 bg-white border-2 border-gray-200 text-gray-700 rounded-2xl font-bold text-lg hover:border-blue-300 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
              >
                Acessar Login
              </button>
            </motion.div>

            {/* Stats */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap justify-center lg:justify-start gap-8 pt-6"
            >
              <div>
                <p className="text-3xl font-black text-gray-900">+24.8%</p>
                <p className="text-sm text-gray-500 font-medium">Aumento de lucratividade</p>
              </div>
              <div>
                <p className="text-3xl font-black text-gray-900">-50%</p>
                <p className="text-sm text-gray-500 font-medium">Redução de tempo</p>
              </div>
              <div>
                <p className="text-3xl font-black text-gray-900">100%</p>
                <p className="text-sm text-gray-500 font-medium">Mobile-First</p>
              </div>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="flex-1 relative"
          >
            <div className="relative rounded-[2rem] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border-8 border-white bg-gray-100 h-[400px] md:h-[500px]">
              <ImageWithFallback 
                src={image_e6773d54ec7685ec36adaaee57705c2d461a8da0} 
                alt="Dashboard Preview" 
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
            {/* Floating Stats Card */}
            <div className="absolute -bottom-10 -left-10 bg-white p-6 rounded-3xl shadow-2xl hidden lg:block border border-gray-50">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Lucratividade</p>
                  <p className="text-2xl font-black text-gray-900">+24.8%</p>
                </div>
              </div>
              <div className="flex gap-1">
                {[40, 70, 45, 90, 65, 80].map((h, i) => (
                  <div key={i} className="w-2 bg-blue-100 rounded-full overflow-hidden flex items-end">
                    <div className="w-full bg-blue-600 rounded-full" style={{ height: `${h}%` }}></div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 bg-gray-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-center text-sm font-bold text-gray-400 uppercase tracking-widest mb-8">Empresas que confiam</p>
          <div className="flex flex-wrap justify-center items-center gap-12 opacity-50 grayscale">
            <div className="flex items-center gap-2"><Package className="w-6 h-6" /><span className="font-bold">LogiCorp</span></div>
            <div className="flex items-center gap-2"><TrendingUp className="w-6 h-6" /><span className="font-bold">FastFood Pro</span></div>
            <div className="flex items-center gap-2"><Truck className="w-6 h-6" /><span className="font-bold">DistribuaX</span></div>
            <div className="flex items-center gap-2"><ShieldCheck className="w-6 h-6" /><span className="font-bold">SafeStock</span></div>
          </div>
        </div>
      </section>

      {/* Differentials Grid */}
      <section className="py-20 px-4 bg-gradient-to-br from-gray-50 to-blue-50/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-blue-600 font-bold text-lg mb-4">Por que escolher o PyrouStock?</h2>
            <p className="text-3xl md:text-4xl font-black text-gray-900">Diferenciais que fazem a diferença</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {differentials.map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                  {item.icon}
                </div>
                <h3 className="text-lg font-bold mb-2 text-gray-900">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 lg:py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-blue-600 font-bold text-lg mb-4">Funcionalidades Premium</h2>
            <p className="text-3xl md:text-5xl font-black text-gray-900 mb-6">Tudo que você precisa para gerir seu negócio</p>
            <p className="text-lg text-gray-600 leading-relaxed">Desenvolvemos uma solução robusta que entende as dores do dia a dia da gestão de estoque e frente de caixa.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -10 }}
                className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-2xl transition-all relative overflow-hidden"
              >
                {feature.badge && (
                  <div className="absolute top-4 right-4 px-3 py-1 bg-gradient-to-r from-green-400 to-emerald-500 text-white text-xs font-black rounded-full shadow-lg">
                    {feature.badge}
                  </div>
                )}
                <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl flex items-center justify-center mb-6 text-blue-600">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold mb-4 text-gray-900">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed mb-6">{feature.description}</p>
                <div className="rounded-2xl overflow-hidden bg-gray-100 h-48">
                  <ImageWithFallback src={feature.image} alt={feature.title} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-gray-50 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-blue-600 font-bold text-lg mb-4">Depoimentos</h2>
            <p className="text-3xl md:text-4xl font-black text-gray-900">O que nossos clientes dizem</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 leading-relaxed italic">"{testimonial.content}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center font-black text-blue-600">
                    {testimonial.name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{testimonial.name}</p>
                    <p className="text-sm text-gray-500">{testimonial.role} - {testimonial.company}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits / Mobile Experience */}
      <section id="benefits" className="py-24 bg-blue-900 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-400 rounded-full blur-[100px]"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 flex flex-col lg:flex-row items-center gap-20">
          <div className="flex-1 order-2 lg:order-1">
            <div className="relative mx-auto w-[280px] h-[580px] bg-gray-800 rounded-[3rem] border-[8px] border-gray-700 shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-700 rounded-b-2xl z-20"></div>
              <div className="w-full h-full rounded-[2rem] overflow-hidden bg-white">
                <img src={dashboardAppImg} alt="Dashboard App" className="w-full h-full object-cover object-top" />
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-8 order-1 lg:order-2">
            <h2 className="text-4xl md:text-5xl font-black leading-tight">Leve seu estoque no bolso com nossa tecnologia PWA.</h2>
            <div className="space-y-6">
              {[
                "Funciona offline em conexões instáveis",
                "Sem necessidade de download em lojas (Google/Apple)",
                "Acesso instantâneo via QR Code ou link",
                "Notificações push em tempo real",
                "Câmera nativa para escaneamento rápido"
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-lg text-blue-100">{text}</span>
                </div>
              ))}
            </div>
            <a 
              href="https://wa.me/5592994764780?text=Olá! Gostaria de ter o PyrouStock no meu celular"
              className="inline-flex items-center gap-3 px-8 py-4 bg-white text-blue-900 rounded-2xl font-bold text-lg hover:bg-blue-50 transition-all"
            >
              Quero no meu celular
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[3rem] p-8 md:p-16 text-center text-white relative overflow-hidden shadow-2xl">
          <div className="relative z-10 space-y-8">
            <h2 className="text-3xl md:text-5xl font-black">Pronto para profissionalizar sua gestão?</h2>
            <p className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto">Agende uma demonstração gratuita com um de nossos consultores e veja como o PyrouStock pode transformar seu negócio hoje.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
              <a 
                href="https://wa.me/5592994764780?text=Olá! Gostaria de agendar uma demonstração do PyrouStock"
                className="bg-white text-blue-600 px-10 py-5 rounded-2xl font-black text-lg hover:bg-blue-50 transition-all shadow-xl flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-6 h-6" />
                Falar com Especialista
              </a>
              <button 
                onClick={onLoginClick}
                className="bg-blue-500/30 backdrop-blur-md border border-white/20 px-10 py-5 rounded-2xl font-black text-lg hover:bg-blue-500/50 transition-all flex items-center justify-center"
              >
                Acessar Minha Conta
              </button>
            </div>
          </div>
          {/* Decorative background elements */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-2xl"></div>
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/10 rounded-full translate-x-1/2 translate-y-1/2 blur-2xl"></div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="PyrouStock Logo" className="w-8 h-8 rounded-lg" />
            <span className="font-black text-xl text-gray-900">PyrouStock</span>
          </div>
          <div className="text-gray-500 text-sm font-medium">
            © 2026 PyrouStock. Todos os direitos reservados.
          </div>
          <div className="flex gap-6 items-center">
            {onAdminClick && (
              <button 
                onClick={onAdminClick}
                className="text-xs text-gray-400 hover:text-indigo-600 font-medium transition-colors flex items-center gap-1"
                title="Acesso Administrativo"
              >
                <LockKeyhole className="w-3 h-3" />
                Admin
              </button>
            )}
            <a href="#" className="text-gray-400 hover:text-blue-600"><TrendingUp className="w-5 h-5" /></a>
            <a href="#" className="text-gray-400 hover:text-blue-600"><ShieldCheck className="w-5 h-5" /></a>
            <a href="#" className="text-gray-400 hover:text-blue-600"><MessageCircle className="w-5 h-5" /></a>
          </div>
        </div>
      </footer>
    </div>
  );
}