import { createContext, ReactNode, useContext, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../services/api';
import { Product, Stock } from '../types';

interface CartProviderProps {
  children: ReactNode;
}

interface UpdateProductAmount {
  productId: number;
  amount: number;
}

interface CartContextData {
  cart: Product[];
  addProduct: (productId: number) => Promise<void>;
  removeProduct: (productId: number) => void;
  updateProductAmount: ({ productId, amount }: UpdateProductAmount) => void;
}

type ProductData = Omit<Product, 'amount'>;

const CartContext = createContext<CartContextData>({} as CartContextData);

export function CartProvider({ children }: CartProviderProps): JSX.Element {
  const [cart, setCart] = useState<Product[]>(() => {
    const storagedCart = localStorage.getItem('@RocketShoes:cart');

    if (!storagedCart) return [];
    return JSON.parse(storagedCart);
  });

  const isProductExist = (productId: Product['id']) =>
    cart.find((product) => product.id === productId);

  const itHasStock = async (productId: Product['id']) => {
    const response = await api.get<Stock>(`/stock/${productId}`);
    return response.data.amount;
  };

  const setToLocalStorage = (updatedCart: Product[]) =>
    localStorage.setItem('@RocketShoes:cart', JSON.stringify(updatedCart));

  const addProduct = async (productId: number) => {
    try {
      const productExist = isProductExist(productId);
      const amountOnStock = await itHasStock(productId);

      if (!!productExist) {
        if (amountOnStock >= productExist.amount + 1) {
          const updatedCart = cart.map((cartProduct) => {
            if (cartProduct.id === productExist.id) {
              return {
                ...cartProduct,
                amount: cartProduct.amount + 1,
              };
            }
            return cartProduct;
          });
          setCart(updatedCart);
          setToLocalStorage(updatedCart);
        } else {
          toast.error('Quantidade solicitada fora de estoque');
        }
      } else if (amountOnStock >= 1) {
        const response = await api.get<ProductData>(`/products/${productId}`);
        const productData = response.data;
        const updatedCart = [
          ...cart,
          {
            ...productData,
            amount: 1,
          },
        ];
        setCart(updatedCart);
        setToLocalStorage(updatedCart);
      }
    } catch {
      toast.error('Erro na adição do produto');
    }
  };

  const removeProduct = (productId: number) => {
    try {
      const productExist = isProductExist(productId);
      if (!productExist) throw Error();
      else {
        const updatedCart = cart.filter(
          (productInCart) => productInCart.id !== productId
        );
        setCart(updatedCart);
        setToLocalStorage(updatedCart);
      }
    } catch {
      toast.error('Erro na remoção do produto');
    }
  };

  const updateProductAmount = async ({
    productId,
    amount,
  }: UpdateProductAmount) => {
    try {
    } catch {
      toast.error('Erro na alteração de quantidade do produto');
    }
  };

  return (
    <CartContext.Provider
      value={{ cart, addProduct, removeProduct, updateProductAmount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextData {
  const context = useContext(CartContext);

  return context;
}
