import React from 'react';
import { 
  CheckCircle2, 
  Smartphone, 
  Zap, 
  ShieldCheck, 
  ArrowRight, 
  MessageCircle,
  Menu,
  X,
  Package,
  TrendingUp,
  Truck,
  Command,
  LockKeyhole,
  Star,
  Receipt,
  CreditCard,
  FileText,
  CloudOff,
  Building2,
  UserRound,
} from 'lucide-react';
import { motion } from 'motion/react';
import image_e6773d54ec7685ec36adaaee57705c2d461a8da0 from 'figma:asset/e6773d54ec7685ec36adaaee57705c2d461a8da0.png';
import logoImg from "figma:asset/e8d336438522d7b8e8099c7d47e7869928dfd8f9.png";
import dashboardAppImg from "figma:asset/0a1edac33c22f30efd413c7ef8bd73eb4788f257.png";
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { APP_NAME, APP_ORIGIN, APP_SITE_URL } from '../../config/branding';

interface LandingPageProps {
  onLoginClick: () => void;
  onAdminClick?: () => void;
}

export function LandingPage({ onLoginClick, onAdminClick }: LandingPageProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const waHref = (text: string) =>
    `https://wa.me/5592994764780?text=${encodeURIComponent(text)}`;

  const features = [
    {
      title: "PDV Offline com Sync Automático",
      description: "Venda com cupom não fiscal sem internet. Catálogo e caixa ficam em cache; a fila sincroniza sozinha ao reconectar, sem duplicar venda ou estoque.",
      icon: <CloudOff className="w-6 h-6 text-sky-700" />,
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvZmZsaW5lJTIwdGVjaG5vbG9neSUyMG1vYmlsZXxlbnwxfHx8fDE3NjkyMDIzMDF8MA&ixlib=rb-4.1.0&q=80&w=1080",
      badge: "NEW"
    },
    {
      title: "NFC-e e NF-e na Venda",
      description: "No checkout escolha cupom interno, NFC-e (mod. 65) ou NF-e (mod. 55). Cliente com busca rápida, cadastro inline e DANFE para reimpressão.",
      icon: <FileText className="w-6 h-6 text-sky-700" />,
      image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
      badge: "NEW"
    },
    {
      title: "Caixa / PDV Completo",
      description: "Abertura e fechamento de caixa, vendas rápidas, sangrias, reforços, recibo e catálogo só com produtos em estoque — pronto para o dia a dia do balcão.",
      icon: <Receipt className="w-6 h-6 text-sky-700" />,
      image: "https://images.unsplash.com/photo-1556742521-9713bf272865?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZXRhaWwlMjBwb3MlMjBzeXN0ZW18ZW58MXx8fHwxNzY5MjAyMzAxfDA&ixlib=rb-4.1.0&q=80&w=1080",
      badge: "HOT"
    },
    {
      title: "Venda Manual e Baixa Avulsa",
      description: "Venda com fiscal ou só baixa de estoque sem gerar cupom/nota. Ideal para desperdício, amostra e ajuste operacional no mesmo fluxo.",
      icon: <Package className="w-6 h-6 text-sky-700" />,
      image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
      badge: "NEW"
    },
    {
      title: "Baixa de Estoque via ZIG",
      description: "Busque vendas da ZIG, selecione os itens e dê baixa no estoque com consolidação por produto e dia — sem processar o que você não marcou.",
      icon: <Zap className="w-6 h-6 text-sky-700" />,
      image: "https://images.unsplash.com/photo-1740914994657-f1cdffdc418e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3YXJlaG91c2UlMjBtYW5hZ2VtZW50JTIwaW52ZW50b3J5fGVufDF8fHx8MTc2OTE2NjY2OXww&ixlib=rb-4.1.0&q=80&w=1080",
      badge: "HOT"
    },
    {
      title: "Pagamentos Flexíveis",
      description: "Dinheiro, PIX, crédito, débito, pagamento misto, fiado e boleto. Controle de troco, sangrias e conferência no fechamento do caixa.",
      icon: <CreditCard className="w-6 h-6 text-sky-700" />,
      image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYXltZW50JTIwbWV0aG9kcyUyMGNhc2hpZXJ8ZW58MXx8fHwxNzY5MjAyMzAxfDA&ixlib=rb-4.1.0&q=80&w=1080",
      badge: null
    },
    {
      title: "Clientes no Checkout",
      description: "Busca por nome ou CPF/CNPJ e cadastro no próprio PDV (sem modal). Para NF-e, endereço completo no mesmo fluxo.",
      icon: <UserRound className="w-6 h-6 text-sky-700" />,
      image: "https://images.unsplash.com/photo-1556745757-8d76bdb6984b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
      badge: null
    },
    {
      title: "Estoque e Entrada Inteligente",
      description: "Entradas, balanço, combos/promos com baixa nos itens filhos, scanner de câmera e importação/sincronização de NF-e de fornecedor.",
      icon: <Truck className="w-6 h-6 text-sky-700" />,
      image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
      badge: null
    },
    {
      title: "Relatórios Inteligentes",
      description: "Vendas, fechamentos, saídas (incluindo ZIG), desperdícios, lucratividade e previsão de demanda. Exporte e acompanhe a operação.",
      icon: <TrendingUp className="w-6 h-6 text-sky-700" />,
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXNoYm9hcmQlMjBhbmFseXRpY3MlMjByZXBvcnRzfGVufDF8fHx8MTc2OTIwMjMwMXww&ixlib=rb-4.1.0&q=80&w=1080",
      badge: null
    },
    {
      title: "PWA Instalável",
      description: "Instale no celular ou desktop como app. Atualização sob controle do operador — sem interrupção no meio da venda.",
      icon: <Smartphone className="w-6 h-6 text-sky-700" />,
      image: "https://images.unsplash.com/photo-1645226880663-81561dcab0ae?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2JpbGUlMjBhcHAlMjBzbWFydHBob25lJTIwYnVzaW5lc3N8ZW58MXx8fHwxNzY5MjAyMzAxfDA&ixlib=rb-4.1.0&q=80&w=1080",
      badge: null
    },
    {
      title: "Multi-Empresa e Permissões",
      description: "Várias empresas no mesmo login, dados isolados e papéis por usuário. Cada time vê só o que precisa operar.",
      icon: <Building2 className="w-6 h-6 text-sky-700" />,
      image: "https://images.unsplash.com/photo-1748609339084-ea43ec1b8fbb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBidXNpbmVzcyUyMGRhc2hib2FyZHxlbnwxfHx8fDE3NjkyNDAxNTV8MA&ixlib=rb-4.1.0&q=80&w=1080",
      badge: null
    },
    {
      title: "Busca Instantânea (⌘K)",
      description: "Ache produto por nome, SKU ou código de barras em segundos. Atalho Cmd/Ctrl+K em qualquer tela.",
      icon: <Command className="w-6 h-6 text-sky-700" />,
      image: "https://images.unsplash.com/photo-1763107228544-2ad5d71c21f0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2JpbGUlMjBhcHAlMjBwcm9kdWN0aXZpdHl8ZW58MXx8fHwxNjkyOTgyMzF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      badge: null
    },
  ];

  const differentials = [
    {
      icon: <CloudOff className="w-6 h-6" />,
      title: "PDV Offline",
      description: "Cupom não fiscal com sync ao voltar"
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: "NFC-e e NF-e",
      description: "Cupom fiscal ou nota modelo 55"
    },
    {
      icon: <Package className="w-6 h-6" />,
      title: "Baixa avulsa",
      description: "Estoque sem venda nem nota"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Baixa ZIG",
      description: "Vendas ZIG → estoque com um clique"
    },
    {
      icon: <Receipt className="w-6 h-6" />,
      title: "Caixa completo",
      description: "Abertura, sangria e fechamento"
    },
    {
      icon: <CreditCard className="w-6 h-6" />,
      title: "Pagamentos",
      description: "PIX, cartão, misto e fiado"
    },
    {
      icon: <UserRound className="w-6 h-6" />,
      title: "Cliente no PDV",
      description: "Busca e cadastro sem modal"
    },
    {
      icon: <Smartphone className="w-6 h-6" />,
      title: "App PWA",
      description: "Instale e use no celular"
    }
  ];

  const testimonials = [
    {
      name: "Carlos Silva",
      role: "Dono de Restaurante",
      company: "Sabor & Arte",
      content: "Na hora do rush a internet cai e o caixa não para. Vendemos offline com cupom e, quando volta a conexão, tudo sincroniza sozinho. Mudou o jogo.",
      rating: 5
    },
    {
      name: "Ana Paula",
      role: "Gerente de Loja",
      company: "Moda Express",
      content: "NFC-e no balcão e NF-e quando o cliente precisa de nota. Cadastro de cliente na hora da venda, sem sair do caixa — a equipe ganhou velocidade.",
      rating: 5
    },
    {
      name: "Roberto Lima",
      role: "Diretor de Operações",
      company: "DistribuMax",
      content: "Multi-empresa com permissões e fechamento de caixa por unidade. Baixa avulsa e ZIG no estoque sem misturar dados entre filiais.",
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
              <img src={logoImg} alt={`${APP_NAME} logo`} className="w-10 h-10 rounded-xl" />
              <span className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {APP_NAME}
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
                href={waHref(`Olá! Gostaria de conhecer o ${APP_NAME}`)} 
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
              href={waHref(`Olá! Gostaria de conhecer o ${APP_NAME}`)}
              className="block w-full text-center bg-blue-600 text-white py-4 rounded-xl font-bold"
            >
              Falar com Consultor
            </a>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-28 pb-16 lg:pt-40 lg:pb-28 px-4 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_rgba(14,165,233,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom_left,_rgba(30,64,175,0.08),_transparent_50%)]" />
        <div className="absolute inset-0 -z-10 opacity-[0.35] [background-image:linear-gradient(rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.03)_1px,transparent_1px)] [background-size:48px_48px]" />

        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-14 lg:gap-20">
          <div className="flex-1 space-y-7 text-center lg:text-left">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-black tracking-[0.22em] uppercase text-sky-700"
            >
              {APP_NAME}
            </motion.p>
            <motion.h1 
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 leading-[1.08] tracking-tight"
            >
              PDV, estoque e notas fiscais{' '}
              <span className="bg-gradient-to-r from-sky-700 to-blue-800 bg-clip-text text-transparent">
                no mesmo fluxo.
              </span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="text-lg md:text-xl text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed"
            >
              Venda offline, NFC-e ou NF-e no checkout, baixa avulsa e sincronização ZIG — operação de balcão sem sair do sistema.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3"
            >
              <a 
                href={waHref(`Olá! Gostaria de falar com um consultor ${APP_NAME}`)}
                className="w-full sm:w-auto px-9 py-4 bg-slate-900 text-white rounded-xl font-bold text-base hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/15 flex items-center justify-center gap-2 group"
              >
                Começar Agora
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
              <button 
                onClick={onLoginClick}
                className="w-full sm:w-auto px-9 py-4 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-base hover:border-sky-300 hover:bg-sky-50/80 transition-all flex items-center justify-center gap-2"
              >
                Acessar Login
              </button>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex-1 w-full"
          >
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.35)] bg-slate-100 aspect-[4/3] max-h-[480px]">
              <ImageWithFallback 
                src={image_e6773d54ec7685ec36adaaee57705c2d461a8da0} 
                alt={`${APP_NAME} — PDV e estoque`} 
                className="absolute inset-0 w-full h-full object-cover"
              />
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
      <section className="py-20 px-4 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-sky-700 font-bold text-sm tracking-widest uppercase mb-3">Por que escolher o {APP_NAME}?</h2>
            <p className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Operação completa no balcão</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {differentials.map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white p-6 rounded-2xl border border-slate-200/80 hover:border-sky-200 hover:shadow-md transition-all"
              >
                <div className="w-11 h-11 bg-sky-50 text-sky-800 rounded-xl flex items-center justify-center mb-4">
                  {item.icon}
                </div>
                <h3 className="text-base font-bold mb-1.5 text-slate-900">{item.title}</h3>
                <p className="text-sm text-slate-600 leading-snug">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 lg:py-28 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-sky-700 font-bold text-sm tracking-widest uppercase mb-3">Funcionalidades</h2>
            <p className="text-3xl md:text-4xl font-black text-slate-900 mb-5 tracking-tight">Do balcão ao estoque, online ou offline</p>
            <p className="text-lg text-slate-600 leading-relaxed">NFC-e, NF-e, baixa avulsa, ZIG, clientes no checkout e relatórios — pensados para operação real.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                className="bg-white p-7 rounded-2xl border border-slate-200/80 hover:border-sky-200 hover:shadow-lg transition-all relative overflow-hidden group"
              >
                {feature.badge && (
                  <div className="absolute top-4 right-4 px-2.5 py-0.5 bg-sky-800 text-white text-[10px] font-bold tracking-wide rounded-md">
                    {feature.badge}
                  </div>
                )}
                <div className="w-12 h-12 bg-sky-50 rounded-xl flex items-center justify-center mb-5 text-sky-800">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 text-slate-900 pr-12">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed mb-5 text-[15px]">{feature.description}</p>
                <div className="rounded-xl overflow-hidden bg-slate-100 h-40">
                  <ImageWithFallback src={feature.image} alt={feature.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500" />
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
            <h2 className="text-4xl md:text-5xl font-black leading-tight">PDV no bolso: venda offline e sincronize depois.</h2>
            <div className="space-y-6">
              {[
                "Cupom não fiscal enfileirado sem internet",
                "Catálogo e caixa em cache no aparelho",
                "Sync automático ao reconectar (sem duplicar)",
                "NFC-e ou NF-e no checkout com cliente inline",
                "Baixa avulsa de estoque sem gerar nota",
                "Instale como PWA — sem loja de apps"
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
              href={waHref(`Olá! Gostaria de ter o ${APP_NAME} no meu celular`)}
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
            <h2 className="text-3xl md:text-5xl font-black">Pronto para vender sem medo da internet?</h2>
            <p className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto">Agende uma demonstração e veja o {APP_NAME} com PDV offline, NFC-e/NF-e, baixa avulsa, ZIG e estoque no mesmo fluxo.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
              <a 
                href={waHref(`Olá! Gostaria de agendar uma demonstração do ${APP_NAME}`)}
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
            <img src={logoImg} alt={`${APP_NAME} logo`} className="w-8 h-8 rounded-lg" />
            <span className="font-black text-xl text-gray-900">{APP_NAME}</span>
          </div>
          <div className="text-gray-500 text-sm font-medium text-center md:text-left">
            <p>© 2026 {APP_NAME}. Todos os direitos reservados.</p>
            <a
              href={APP_SITE_URL}
              className="text-blue-600 hover:underline mt-1 inline-block break-all"
              rel="noopener noreferrer"
            >
              {APP_ORIGIN}
            </a>
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