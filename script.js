/* Фиксированная ширина кнопки избранного */
.fav-btn {
  width: 36px;
  height: 36px;
  min-width: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: rgba(255,255,255,0.9);
  border-radius: 50%;
  border: none;
  cursor: pointer;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

/* Анимация при клике */
.fav-btn.animating {
  animation: favClick 0.3s ease;
}

@keyframes favClick {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

/* Активное состояние */
.fav-btn.active {
  color: #e74c3c;
}

/* Рамка карточки при добавлении в избранное */
.card.fav-active {
  border-color: #e74c3c;
  box-shadow: 0 0 15px rgba(231, 76, 60, 0.2);
}
